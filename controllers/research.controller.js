import { v4 as uuidv4 } from 'uuid';
import ResearchSession from '../models/ResearchSession.model.js';
import User from '../models/user.model.js';
import { sendToN8nWebhook, sendToPhase2Webhook, sendToPhase3Webhook, sendToPhase4Webhook, sendToPhase5Webhook, sendToPhase6Webhook } from '../services/n8n.service.js';
import { cleanAbstract } from '../utils/textCleaner.js';

/**
 * POST /api/research/initiate
 * Initiates Phase 1: Prompt Enhancement
 */
export const initiateResearch = async (req, res) => {
  try {
    const { problemStatement, metadata } = req.body;

    // Validate problem statement
    if (!problemStatement || typeof problemStatement !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Problem statement is required and must be a string'
      });
    }

    // Validate minimum word count (30 words)
    const wordCount = problemStatement.trim().split(/\s+/).length;
    if (wordCount < 30) {
      return res.status(400).json({
        success: false,
        error: `Problem statement must be at least 30 words. Current word count: ${wordCount}`
      });
    }

    // Generate unique chatId
    const chatId = uuidv4();

    // Get user email from request body
    const userEmail = req.body.userEmail || null;

    // Create new research session
    const researchSession = new ResearchSession({
      userId: req.user?.userId || null,
      userEmail,
      chatId,
      originalInput: problemStatement.trim(),
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        ...metadata
      }
    });

    // Update Phase 1 status to processing
    researchSession.phases.phase1.status = 'processing';
    researchSession.phases.phase1.startedAt = new Date();
    researchSession.overallStatus = 'processing';
    researchSession.progress = 10;

    // Add chatId to user's researchSessions array if user email is provided
    if (userEmail) {
      await User.findOneAndUpdate(
        { email: userEmail },
        { $addToSet: { researchSessions: chatId } }
      );
    }

    await researchSession.save();

    // Send to n8n webhook asynchronously
    sendToN8nWebhook(chatId, problemStatement)
      .then(async (n8nResponse) => {
        // Update session with n8n response
        const session = await ResearchSession.findOne({ chatId });
        
        session.enhancedInput = n8nResponse.enhancedPrompt || problemStatement;
        session.refinedProblem = n8nResponse.refinedProblem;
        session.subtopics = n8nResponse.subtopics || [];
        session.refineProblemEmbedding = n8nResponse.refineProblemEmbedding || null;
        session.phases.phase1.n8nWebhookSent = true;
        session.phases.phase1.n8nResponse = n8nResponse;

        // Validate Phase 1 data before marking as completed
        console.log('🔍 Phase 1 Complete - Validating data:', {
          chatId,
          hasRefinedProblem: !!n8nResponse.refinedProblem,
          hasSubtopics: !!n8nResponse.subtopics,
          subtopicsCount: n8nResponse.subtopics?.length || 0,
          hasEmbedding: !!n8nResponse.refineProblemEmbedding
        });

        const hasValidPhase1Data = n8nResponse.refinedProblem && 
                                    n8nResponse.subtopics && 
                                    n8nResponse.subtopics.length > 0;

        if (!hasValidPhase1Data) {
          console.error(`❌ Phase 1 returned invalid data for chatId: ${chatId}`);
          session.phases.phase1.status = 'failed';
          session.phases.phase1.completedAt = new Date();
          session.phases.phase1.error = 'Phase 1 did not generate refinedProblem or subtopics';
          session.overallStatus = 'failed';
          session.progress = 10;
          await session.save();
          return;
        }

        // Mark Phase 1 as completed only if data is valid
        session.phases.phase1.status = 'completed';
        session.phases.phase1.completedAt = new Date();
        session.progress = 10;
        await session.save();

        // Automatically trigger Phase 2
        triggerPhase2(chatId, n8nResponse.refinedProblem, n8nResponse.subtopics, n8nResponse.refineProblemEmbedding);
      })
      .catch(async (error) => {
        // Handle n8n webhook error
        const session = await ResearchSession.findOne({ chatId });
        
        session.phases.phase1.status = 'failed';
        session.phases.phase1.completedAt = new Date();
        session.phases.phase1.error = error.message;
        session.overallStatus = 'failed';

        await session.save();

        console.error(`❌ Phase 1 failed for chatId: ${chatId}`, error.message);
      });

    // Return immediate response with chatId
    res.status(201).json({
      success: true,
      message: 'Research session initiated. Phase 1 (Prompt Enhancement) is processing.',
      data: {
        chatId,
        originalInput: problemStatement,
        currentPhase: 1,
        status: 'processing',
        progress: 10,
        estimatedTime: '30-60 seconds'
      }
    });

  } catch (error) {
    console.error('Error initiating research:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate research session',
      details: error.message
    });
  }
};

/**
 * GET /api/research/status/:chatId
 * Get current status of a research session
 */
export const getSessionStatus = async (req, res) => {
  try {
    const { chatId } = req.params;

    const session = await ResearchSession.findOne({ chatId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Research session not found'
      });
    }

    // AUTO-FIX: Validate all completed phases have proper data
    let wasFixed = false;
    
    // Phase 1: Check refinedProblem and subtopics
    if (session.phases.phase1.status === 'completed') {
      const hasValidPhase1Data = session.refinedProblem && 
                                  session.subtopics && 
                                  session.subtopics.length > 0;
      
      if (!hasValidPhase1Data) {
        session.phases.phase1.status = 'failed';
        session.phases.phase1.error = 'Phase 1 was completed but refinedProblem or subtopics are missing. Please retry Phase 1.';
        wasFixed = true;
        console.warn(`⚠️ Auto-fixed Phase 1 status for chatId: ${chatId} - missing refinedProblem or subtopics`);
        await session.save();
      }
    }
    
    // Phase 2: Check papers array has data
    if (session.phases.phase2.status === 'completed') {
      const hasValidPhase2Data = session.papers && 
                                  session.papers.length > 0 &&
                                  session.papers.some(p => p.pdfLink);
      
      if (!hasValidPhase2Data) {
        session.phases.phase2.status = 'failed';
        session.phases.phase2.error = 'Phase 2 was completed but no papers with PDF links were found. Please retry Phase 2.';
        wasFixed = true;
        console.warn(`⚠️ Auto-fixed Phase 2 status for chatId: ${chatId} - no papers found`);
        await session.save();
      }
    }
    
    // Phase 3: Check papers have enriched data
    if (session.phases.phase3.status === 'completed') {
      const hasValidPhase3Data = session.papers && 
                                  session.papers.length > 0 &&
                                  session.papers.some(p => p.summary && p.methodology);
      
      if (!hasValidPhase3Data) {
        session.phases.phase3.status = 'failed';
        session.phases.phase3.error = 'Phase 3 was completed but papers lack analysis data (summary/methodology). Please retry Phase 3.';
        wasFixed = true;
        console.warn(`⚠️ Auto-fixed Phase 3 status for chatId: ${chatId} - papers not enriched`);
        await session.save();
      }
    }
    
    // Phase 4: Check phase4Analysis has data
    if (session.phases.phase4.status === 'completed') {
      const hasValidPhase4Data = session.phase4Analysis && (
        (session.phase4Analysis.mostCommonMethodologies?.length > 0) ||
        (session.phase4Analysis.technologyOrAlgorithms?.length > 0) ||
        (session.phase4Analysis.datasetsUsed?.length > 0) ||
        (session.phase4Analysis.uniqueOrLessCommonApproaches?.length > 0)
      );

      if (!hasValidPhase4Data) {
        session.phases.phase4.status = 'failed';
        session.phases.phase4.error = 'Phase 4 was completed but phase4Analysis is empty. Data was not properly saved. Please retry Phase 4.';
        wasFixed = true;
        console.warn(`⚠️ Auto-fixed Phase 4 status for chatId: ${chatId} - phase4Analysis is empty`);
        await session.save();
      }
    }
    
    // Phase 5: Check phase5Solutions has data
    if (session.phases.phase5.status === 'completed') {
      const hasValidPhase5Data = session.phase5Solutions && 
                                  session.phase5Solutions.length > 0;
      
      if (!hasValidPhase5Data) {
        session.phases.phase5.status = 'failed';
        session.phases.phase5.error = 'Phase 5 was completed but phase5Solutions is empty. Please retry Phase 5.';
        wasFixed = true;
        console.warn(`⚠️ Auto-fixed Phase 5 status for chatId: ${chatId} - no solutions found`);
        await session.save();
      }
    }
    
    // Phase 6: Check phase6Solution exists
    if (session.phases.phase6.status === 'completed') {
      const hasValidPhase6Data = session.phase6Solution && 
                                  session.phase6Solution.proposedSolution;
      
      if (!hasValidPhase6Data) {
        session.phases.phase6.status = 'failed';
        session.phases.phase6.error = 'Phase 6 was completed but phase6Solution is missing. Please retry Phase 6.';
        wasFixed = true;
        console.warn(`⚠️ Auto-fixed Phase 6 status for chatId: ${chatId} - no solution proposal`);
        await session.save();
      }
    }

    res.status(200).json({
      success: true,
      data: {
        chatId: session.chatId,
        currentPhase: session.currentPhase,
        overallStatus: session.overallStatus,
        progress: session.progress,
        phase1Status: session.phases.phase1.status,
        phase2Status: session.phases.phase2.status,
        phase3Status: session.phases.phase3.status,
        phase4Status: session.phases.phase4.status,
        enhancedInput: session.enhancedInput,
        refinedProblem: session.refinedProblem,
        subtopics: session.subtopics,
        subtopicsCount: session.subtopics?.length || 0,
        phase2Data: session.phases.phase2.phase2Data,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        autoFixed: wasFixed
      }
    });

  } catch (error) {
    console.error('Error fetching session status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session status',
      details: error.message
    });
  }
};

/**
 * GET /api/research/session/:chatId
 * Get full details of a research session
 */
export const getSessionDetails = async (req, res) => {
  try {
    const { chatId } = req.params;

    const session = await ResearchSession.findOne({ chatId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Research session not found'
      });
    }

    // AUTO-FIX: Validate all completed phases have proper data
    let needsSave = false;
    
    // Phase 1: Check refinedProblem and subtopics
    if (session.phases.phase1.status === 'completed') {
      const hasValidPhase1Data = session.refinedProblem && 
                                  session.subtopics && 
                                  session.subtopics.length > 0;
      
      if (!hasValidPhase1Data) {
        session.phases.phase1.status = 'failed';
        session.phases.phase1.error = 'Phase 1 was completed but refinedProblem or subtopics are missing. Please retry Phase 1.';
        needsSave = true;
        console.warn(`⚠️ Auto-fixed Phase 1 status for chatId: ${chatId} - missing refinedProblem or subtopics`);
      }
    }
    
    // Phase 2: Check papers array has data
    if (session.phases.phase2.status === 'completed') {
      const hasValidPhase2Data = session.papers && 
                                  session.papers.length > 0 &&
                                  session.papers.some(p => p.pdfLink);
      
      if (!hasValidPhase2Data) {
        session.phases.phase2.status = 'failed';
        session.phases.phase2.error = 'Phase 2 was completed but no papers with PDF links were found. Please retry Phase 2.';
        needsSave = true;
        console.warn(`⚠️ Auto-fixed Phase 2 status for chatId: ${chatId} - no papers found`);
      }
    }
    
    // Phase 3: Check papers have enriched data
    if (session.phases.phase3.status === 'completed') {
      const hasValidPhase3Data = session.papers && 
                                  session.papers.length > 0 &&
                                  session.papers.some(p => p.summary && p.methodology);
      
      if (!hasValidPhase3Data) {
        session.phases.phase3.status = 'failed';
        session.phases.phase3.error = 'Phase 3 was completed but papers lack analysis data (summary/methodology). Please retry Phase 3.';
        needsSave = true;
        console.warn(`⚠️ Auto-fixed Phase 3 status for chatId: ${chatId} - papers not enriched`);
      }
    }
    
    // Phase 4: Check phase4Analysis has data
    if (session.phases.phase4.status === 'completed') {
      const hasValidPhase4Data = session.phase4Analysis && (
        (session.phase4Analysis.mostCommonMethodologies?.length > 0) ||
        (session.phase4Analysis.technologyOrAlgorithms?.length > 0) ||
        (session.phase4Analysis.datasetsUsed?.length > 0) ||
        (session.phase4Analysis.uniqueOrLessCommonApproaches?.length > 0)
      );

      if (!hasValidPhase4Data) {
        session.phases.phase4.status = 'failed';
        session.phases.phase4.error = 'Phase 4 was completed but phase4Analysis is empty. Data was not properly saved. Please retry Phase 4.';
        needsSave = true;
        console.warn(`⚠️ Auto-fixed Phase 4 status for chatId: ${chatId} - phase4Analysis is empty`);
      }
    }
    
    // Phase 5: Check phase5Solutions has data
    if (session.phases.phase5.status === 'completed') {
      const hasValidPhase5Data = session.phase5Solutions && 
                                  session.phase5Solutions.length > 0;
      
      if (!hasValidPhase5Data) {
        session.phases.phase5.status = 'failed';
        session.phases.phase5.error = 'Phase 5 was completed but phase5Solutions is empty. Please retry Phase 5.';
        needsSave = true;
        console.warn(`⚠️ Auto-fixed Phase 5 status for chatId: ${chatId} - no solutions found`);
      }
    }
    
    // Phase 6: Check phase6Solution exists
    if (session.phases.phase6.status === 'completed') {
      const hasValidPhase6Data = session.phase6Solution && 
                                  session.phase6Solution.proposedSolution;
      
      if (!hasValidPhase6Data) {
        session.phases.phase6.status = 'failed';
        session.phases.phase6.error = 'Phase 6 was completed but phase6Solution is missing. Please retry Phase 6.';
        needsSave = true;
        console.warn(`⚠️ Auto-fixed Phase 6 status for chatId: ${chatId} - no solution proposal`);
      }
    }
    
    // Save if any phase was fixed
    if (needsSave) {
      await session.save();
    }

    res.status(200).json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session details',
      details: error.message
    });
  }
};

/**
 * GET /api/research/sessions
 * Get all research sessions with pagination
 */
/**
 * POST /api/research/:chatId/retry-phase
 * Retry a specific phase with option to delete existing data or merge
 */
export const retryPhase = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { phase, deleteExisting } = req.body;

    // Validate phase number
    if (!phase || phase < 1 || phase > 6) {
      return res.status(400).json({
        success: false,
        error: 'Valid phase number (1-6) is required'
      });
    }

    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Research session not found'
      });
    }

    // Check if phase was previously executed or is stuck in processing
    const phaseKey = `phase${phase}`;
    const phaseStatus = session.phases[phaseKey]?.status;
    const phaseStartedAt = session.phases[phaseKey]?.startedAt;

    // Allow retry if phase was completed, failed, or processing
    // Only reject if phase is truly pending (never started)
    if (!phaseStatus || (phaseStatus === 'pending' && phase > 1)) {
      // Check if previous phase is completed
      const prevPhaseKey = `phase${phase - 1}`;
      const prevPhaseStatus = session.phases[prevPhaseKey]?.status;
      
      if (prevPhaseStatus !== 'completed') {
        return res.status(400).json({
          success: false,
          error: `Phase ${phase} cannot be started. Previous phase not completed.`
        });
      }
      // If previous phase is completed, allow starting this phase
    }

    // If phase is stuck in processing, mark it as failed before retrying
    if (phaseStatus === 'processing') {
      session.phases[phaseKey].status = 'failed';
      session.phases[phaseKey].error = 'Process was interrupted or timed out';
      session.phases[phaseKey].completedAt = new Date();
    }

    // If phase is completed but being retried, log it
    if (phaseStatus === 'completed') {
      // Re-running completed phase (manual retry)
    }

    // If deleteExisting is true, clear the phase data
    if (deleteExisting) {
      // Clear phase-specific data based on phase number
      switch(phase) {
        case 1:
          session.refinedProblem = '';
          session.subtopics = [];
          session.embedding = [];
          break;
        case 2:
          session.papers = [];
          break;
        case 3:
          // Keep papers but clear Phase 3 specific fields
          session.papers = session.papers.map(paper => ({
            title: paper.title,
            authors: paper.authors,
            abstract: paper.abstract,
            pdfLink: paper.pdfLink,
            semanticScore: paper.semanticScore,
            year: paper.year
          }));
          break;
        case 4:
          session.phase4Analysis = {
            mostCommonMethodologies: [],
            technologyOrAlgorithms: [],
            datasetsUsed: [],
            uniqueOrLessCommonApproaches: []
          };
          break;
        case 5:
          session.phase5Solutions = [];
          session.phase5Notes = '';
          break;
        case 6:
          session.phase6Solution = null;
          break;
      }

      // Reset phase status
      session.phases[phaseKey] = {
        status: 'pending',
        startedAt: null,
        completedAt: null,
        error: null,
        n8nWebhookSent: false,
        n8nResponse: null,
        [`${phaseKey}Data`]: null
      };
    }

    await session.save();

    // Trigger the phase based on phase number
    let triggerFunction;
    switch(phase) {
      case 1:
        triggerFunction = () => triggerPhase1Retry(chatId, session.originalInput);
        break;
      case 2:
        triggerFunction = () => triggerPhase2Retry(chatId, session.refinedProblem, session.subtopics, session.embedding, deleteExisting);
        break;
      case 3:
        triggerFunction = () => triggerPhase3Retry(chatId, session.papers, deleteExisting);
        break;
      case 4:
        triggerFunction = () => triggerPhase4Retry(chatId, session.refinedProblem, deleteExisting);
        break;
      case 5:
        triggerFunction = () => triggerPhase5Retry(chatId, session.refinedProblem, deleteExisting);
        break;
      case 6:
        triggerFunction = () => triggerPhase6Retry(chatId, session.refinedProblem, deleteExisting);
        break;
    }

    // Execute in background
    triggerFunction();

    res.status(200).json({
      success: true,
      message: `Phase ${phase} retry initiated`,
      data: {
        chatId,
        phase,
        deleteExisting,
        status: 'processing'
      }
    });

  } catch (error) {
    console.error('Error in retryPhase:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export const getAllSessions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const userEmail = req.query.userEmail;

    // Build query based on user email
    let query = {};
    if (userEmail) {
      const user = await User.findOne({ email: userEmail }).select('researchSessions');
      if (user && user.researchSessions.length > 0) {
        query = { chatId: { $in: user.researchSessions } };
      } else {
        // User exists but has no sessions yet
        query = { chatId: { $in: [] } };
      }
    }

    const sessions = await ResearchSession.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-phases.phase1.n8nResponse'); // Exclude large response data

    const total = await ResearchSession.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        sessions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalSessions: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions',
      details: error.message
    });
  }
};

export const stopPhase = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { phase } = req.body;

    if (!phase || phase < 1 || phase > 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phase number. Must be between 1 and 6'
      });
    }

    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Research session not found'
      });
    }

    const phaseKey = `phase${phase}`;
    const currentStatus = session.phases[phaseKey]?.status;

    // Only allow stopping phases that are in 'processing' state
    if (currentStatus !== 'processing') {
      return res.status(400).json({
        success: false,
        error: `Phase ${phase} is not currently processing (status: ${currentStatus})`
      });
    }

    // Mark phase as failed
    session.phases[phaseKey].status = 'failed';
    session.phases[phaseKey].error = 'Phase manually stopped by user';
    session.phases[phaseKey].completedAt = new Date();

    await session.save();

    res.status(200).json({
      success: true,
      message: `Phase ${phase} stopped successfully`,
      data: {
        chatId,
        phase,
        newStatus: 'failed'
      }
    });

  } catch (error) {
    console.error('Error stopping phase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop phase',
      details: error.message
    });
  }
};

export const deleteSession = async (req, res) => {
  try {
    const { chatId } = req.params;

    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Research session not found'
      });
    }

    await ResearchSession.deleteOne({ chatId });

    res.status(200).json({
      success: true,
      message: 'Research session deleted successfully',
      data: {
        chatId,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
      details: error.message
    });
  }
};

/**
 * Trigger Phase 2 processing
 * @param {string} chatId - Unique chat identifier
 * @param {string} refinedProblem - Refined problem from Phase 1
 * @param {Array} subtopics - Subtopics from Phase 1
 * @param {Array} embedding - Problem embedding vector from Phase 1
 */
const triggerPhase2 = async (chatId, refinedProblem, subtopics, embedding) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Check if Phase 2 is already completed with valid data
    if (session.phases.phase2.status === 'completed') {
      const hasValidData = session.papers && session.papers.length > 0 && session.papers.some(p => p.pdfLink);
      if (hasValidData) {
        console.log(`⏭️ Phase 2 already completed for chatId: ${chatId}, skipping...`);
        // Trigger Phase 3 if not completed
        if (session.phases.phase3.status !== 'completed') {
          const pdfLinks = session.papers.map(p => p.pdfLink).filter(link => link);
          if (pdfLinks.length > 0) {
            triggerPhase3(chatId, pdfLinks);
          }
        }
        return;
      }
    }

    // Update Phase 2 status to processing
    session.phases.phase2.status = 'processing';
    session.phases.phase2.startedAt = new Date();
    session.currentPhase = 2;
    session.progress = 15;
    
    await session.save();

    // Send to Phase 2 n8n webhook
    sendToPhase2Webhook(chatId, refinedProblem, subtopics, embedding)
      .then(async (phase2Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        // Parse and store papers data from Phase 2
        // phase2Data is already an array of paper objects from n8n
        const papers = phase2Response.phase2Data || [];
        const formattedPapers = Array.isArray(papers) ? papers.map(paper => {
          // Handle authors as string or array
          let authorsArray = [];
          if (Array.isArray(paper.authors)) {
            authorsArray = paper.authors;
          } else if (typeof paper.authors === 'string') {
            authorsArray = paper.authors.split(',').map(a => a.trim()).filter(a => a);
          }
          
          return {
            title: paper.title || '',
            authors: authorsArray,
            abstract: cleanAbstract(paper.abstract || ''),
            pdfLink: paper.pdf_url || '',
            semanticScore: paper.semantic_score || 0,
            semanticScorePercent: Math.round(paper.semantic_score * 100) || null,
            year: paper.year || null
          };
        }) : [];
        
        // Store papers immediately for Phase 2 table display
        updatedSession.papers = formattedPapers;
        updatedSession.phases.phase2.n8nWebhookSent = true;
        updatedSession.phases.phase2.n8nResponse = phase2Response;
        updatedSession.phases.phase2.phase2Data = formattedPapers; // Store for Phase 3 matching
        
        // Automatically trigger Phase 3 with PDF links
        const pdfLinks = formattedPapers.map(p => p.pdfLink).filter(link => link);
        if (pdfLinks.length > 0) {
          updatedSession.phases.phase2.status = 'completed';
          updatedSession.phases.phase2.completedAt = new Date();
          updatedSession.progress = 25;
          await updatedSession.save();
          
          triggerPhase3(chatId, pdfLinks);
        } else {
          // No papers found - mark Phase 2 as failed
          updatedSession.phases.phase2.status = 'failed';
          updatedSession.phases.phase2.completedAt = new Date();
          updatedSession.phases.phase2.error = 'No papers found with valid PDF links';
          updatedSession.progress = 25;
          await updatedSession.save();
          
          console.error(`❌ Phase 2 completed but no papers found for chatId: ${chatId}`);
        }
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        updatedSession.phases.phase2.status = 'failed';
        updatedSession.phases.phase2.completedAt = new Date();
        updatedSession.phases.phase2.error = error.message;
        
        await updatedSession.save();
        
        console.error(`❌ Phase 2 failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase2:', error);
  }
};

/**
 * Trigger Phase 3 processing
 * @param {string} chatId - Unique chat identifier
 * @param {Array} pdfLinks - PDF links from Phase 2
 */
const triggerPhase3 = async (chatId, pdfLinks) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Check if Phase 3 is already completed with valid data
    if (session.phases.phase3.status === 'completed') {
      const hasValidData = session.papers && session.papers.length > 0 && session.papers.some(p => p.summary && p.methodology);
      if (hasValidData) {
        console.log(`⏭️ Phase 3 already completed for chatId: ${chatId}, skipping...`);
        // Trigger Phase 4 if not completed
        if (session.phases.phase4.status !== 'completed' && session.refinedProblem) {
          triggerPhase4(chatId, session.refinedProblem);
        }
        return;
      }
    }

    // Update Phase 3 status to processing
    session.phases.phase3.status = 'processing';
    session.phases.phase3.startedAt = new Date();
    session.currentPhase = 3;
    session.progress = 40;
    
    await session.save();

    console.log(`🔄 Phase 3 started for chatId: ${chatId} with ${pdfLinks.length} PDF links`);

    // Send to Phase 3 n8n webhook
    sendToPhase3Webhook(chatId, pdfLinks)
      .then(async (phase3Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        // Parse Phase 3 data - handle both array and object responses
        let phase3Papers = [];
        if (Array.isArray(phase3Response)) {
          // n8n sent array directly
          phase3Papers = phase3Response;
        } else if (phase3Response.phase3Data) {
          // n8n sent object with phase3Data property
          phase3Papers = phase3Response.phase3Data;
        }
        
        // Only keep papers that have Phase 3 analysis (summary and methodology)
        const enrichedPapers = [];
        
        if (Array.isArray(phase3Papers) && phase3Papers.length > 0) {
          // Get Phase 2 papers from temporary storage
          const phase2Papers = updatedSession.phases.phase2.phase2Data || [];
          
          phase3Papers.forEach(p3 => {
            // Only include if has summary AND methodology
            if (p3.summary && p3.methodology) {
              // Find matching Phase 2 paper for additional data
              const phase2Match = phase2Papers.find(p2 => 
                p3.pdf_link === p2.pdfLink || 
                p3.pdf_link?.includes(p2.pdfLink) || 
                p2.pdfLink?.includes(p3.pdf_link)
              );
              
              if (phase2Match) {
                enrichedPapers.push({
                  title: p3.title || phase2Match.title,
                  authors: phase2Match.authors,
                  abstract: phase2Match.abstract,
                  pdfLink: p3.pdf_link,
                  semanticScore: phase2Match.semanticScore,
                  semanticScorePercent: phase2Match.semanticScorePercent,
                  year: p3.year || phase2Match.year,
                  summary: p3.summary,
                  methodology: p3.methodology,
                  algorithmsUsed: p3.algorithms_used || [],
                  result: p3.result || '',
                  conclusion: p3.conclusion || '',
                  limitations: p3.limitations || 'Not mentioned',
                  futureScope: p3.future_scope || 'Not mentioned'
                });
              }
            }
          });
          
          updatedSession.papers = enrichedPapers;
        }
        
        updatedSession.phases.phase3.n8nWebhookSent = true;
        updatedSession.phases.phase3.n8nResponse = phase3Response;
        updatedSession.phases.phase3.phase3Data = phase3Papers;
        
        // Check if we got enriched papers
        if (enrichedPapers.length > 0) {
          updatedSession.phases.phase3.status = 'completed';
          updatedSession.phases.phase3.completedAt = new Date();
          updatedSession.progress = 55;
          await updatedSession.save();
          
          // Automatically trigger Phase 4 with chatId and refined problem
          const refinedProblem = updatedSession.refinedProblem;
          if (refinedProblem) {
            triggerPhase4(chatId, refinedProblem);
          }
        } else {
          // No enriched papers - mark Phase 3 as failed
          updatedSession.phases.phase3.status = 'failed';
          updatedSession.phases.phase3.completedAt = new Date();
          updatedSession.phases.phase3.error = 'No papers were enriched with analysis data from n8n';
          updatedSession.progress = 40;
          await updatedSession.save();
          
          console.error(`❌ Phase 3 webhook responded but no enriched papers for chatId: ${chatId}`);
        }
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        updatedSession.phases.phase3.status = 'failed';
        updatedSession.phases.phase3.completedAt = new Date();
        updatedSession.phases.phase3.error = error.message;
        
        await updatedSession.save();
        
        console.error(`❌ Phase 3 failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase3:', error);
  }
};

/**
 * Trigger Phase 4: Send chatId and refined problem to n8n webhook
 * @param {string} chatId - Research session ID
 * @param {string} refinedProblem - Refined problem statement
 */
const triggerPhase4 = async (chatId, refinedProblem) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Check if Phase 4 is already completed with valid data
    if (session.phases.phase4.status === 'completed') {
      const hasValidData = session.phase4Analysis && (
        (session.phase4Analysis.mostCommonMethodologies?.length > 0) ||
        (session.phase4Analysis.technologyOrAlgorithms?.length > 0) ||
        (session.phase4Analysis.datasetsUsed?.length > 0) ||
        (session.phase4Analysis.uniqueOrLessCommonApproaches?.length > 0)
      );
      if (hasValidData) {
        console.log(`⏭️ Phase 4 already completed for chatId: ${chatId}, skipping...`);
        // Trigger Phase 5 if not completed
        if (session.phases.phase5.status !== 'completed' && refinedProblem) {
          triggerPhase5(chatId, refinedProblem);
        }
        return;
      }
    }

    // Update Phase 4 status to processing
    session.phases.phase4.status = 'processing';
    session.phases.phase4.startedAt = new Date();
    session.currentPhase = 4;
    session.progress = 60;
    
    await session.save();

    // Send to Phase 4 n8n webhook
    sendToPhase4Webhook(chatId, refinedProblem)
      .then(async (phase4Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        // Parse Phase 4 response - phase4Data is the direct response object, not an array
        const phase4Data = phase4Response.phase4Data;
        
        console.log('📥 Phase 4 Response:', {
          isArray: Array.isArray(phase4Data),
          hasPhase4Data: !!phase4Data,
          dataType: typeof phase4Data,
          keys: phase4Data ? Object.keys(phase4Data) : []
        });
        
        // Handle both array and direct object response
        let cleanedOutput;
        if (Array.isArray(phase4Data) && phase4Data.length > 0) {
          cleanedOutput = phase4Data[0]?.cleanedOutput;
        } else if (phase4Data && phase4Data.cleanedOutput) {
          // Direct object response
          cleanedOutput = phase4Data.cleanedOutput;
        }
          
        if (cleanedOutput) {
          // Direct assignment to nested properties
          if (!updatedSession.phase4Analysis) {
            updatedSession.phase4Analysis = {};
          }
          
          updatedSession.phase4Analysis.mostCommonMethodologies = cleanedOutput.most_common_methodologies || [];
          updatedSession.phase4Analysis.technologyOrAlgorithms = cleanedOutput.technology_or_algorithms || [];
          updatedSession.phase4Analysis.datasetsUsed = cleanedOutput.datasets_used || [];
          updatedSession.phase4Analysis.uniqueOrLessCommonApproaches = cleanedOutput.unique_or_less_common_approaches || [];
          
          // Mark as modified for Mongoose
          updatedSession.markModified('phase4Analysis');
          
          console.log('✅ Phase 4 Analysis stored:', {
            methodologies: updatedSession.phase4Analysis.mostCommonMethodologies?.length || 0,
            technologies: updatedSession.phase4Analysis.technologyOrAlgorithms?.length || 0,
            datasets: updatedSession.phase4Analysis.datasetsUsed?.length || 0,
            uniqueApproaches: updatedSession.phase4Analysis.uniqueOrLessCommonApproaches?.length || 0
          });
        }
        
        updatedSession.phases.phase4.n8nWebhookSent = true;
        updatedSession.phases.phase4.n8nResponse = phase4Response;
        updatedSession.phases.phase4.phase4Data = phase4Response.phase4Data;
        
        // CRITICAL VALIDATION: Check phase4Analysis in database (not just cleanedOutput)
        // This ensures phase4Analysis was actually populated, not just received a response
        const hasValidAnalysisData = updatedSession.phase4Analysis && (
          (updatedSession.phase4Analysis.mostCommonMethodologies?.length > 0) ||
          (updatedSession.phase4Analysis.technologyOrAlgorithms?.length > 0) ||
          (updatedSession.phase4Analysis.datasetsUsed?.length > 0) ||
          (updatedSession.phase4Analysis.uniqueOrLessCommonApproaches?.length > 0)
        );
        
        if (hasValidAnalysisData) {
          updatedSession.phases.phase4.status = 'completed';
          updatedSession.phases.phase4.completedAt = new Date();
          updatedSession.progress = 70;
          await updatedSession.save();
          
          console.log(`✅ Phase 4 completed successfully for chatId: ${chatId}`);
          
          // Automatically trigger Phase 5 after Phase 4 completion
          triggerPhase5(chatId, refinedProblem);
        } else {
          // No analysis data in phase4Analysis - mark Phase 4 as failed
          updatedSession.phases.phase4.status = 'failed';
          updatedSession.phases.phase4.completedAt = new Date();
          updatedSession.phases.phase4.error = 'Phase 4 completed but phase4Analysis is empty. Data parsing or structure mismatch detected.';
          updatedSession.progress = 60;
          await updatedSession.save();
          
          console.error(`❌ Phase 4 webhook responded but phase4Analysis is empty for chatId: ${chatId}`, {
            hadCleanedOutput: !!cleanedOutput,
            phase4DataKeys: phase4Response.phase4Data ? Object.keys(phase4Response.phase4Data) : [],
            phase4AnalysisState: updatedSession.phase4Analysis
          });
        }
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        updatedSession.phases.phase4.status = 'failed';
        updatedSession.phases.phase4.completedAt = new Date();
        updatedSession.phases.phase4.error = error.message;
        
        await updatedSession.save();
        
        console.error(`❌ Phase 4 failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase4:', error);
  }
};

/**
 * Trigger Phase 5: Send chatId and refined problem to n8n webhook to get solutions
 * @param {string} chatId - Research session ID
 * @param {string} refinedProblem - Refined problem statement
 */
const triggerPhase5 = async (chatId, refinedProblem) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Check if Phase 5 is already completed with valid data
    if (session.phases.phase5.status === 'completed') {
      const hasValidData = session.phase5Solutions && session.phase5Solutions.length > 0;
      if (hasValidData) {
        console.log(`⏭️ Phase 5 already completed for chatId: ${chatId}, skipping...`);
        // Trigger Phase 6 if not completed
        if (session.phases.phase6.status !== 'completed' && refinedProblem) {
          triggerPhase6(chatId, refinedProblem);
        }
        return;
      }
    }

    // Update Phase 5 status to processing
    session.phases.phase5.status = 'processing';
    session.phases.phase5.startedAt = new Date();
    session.currentPhase = 5;
    session.progress = 75;
    
    await session.save();

    // Send to Phase 5 n8n webhook
    sendToPhase5Webhook(chatId, refinedProblem)
      .then(async (phase5Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        // Parse Phase 5 response - handle both array and direct object
        const phase5Data = phase5Response.phase5Data;
        
        let solutions, notes;
        if (Array.isArray(phase5Data) && phase5Data.length > 0) {
          // Array format: [{ solutions: [...] }]
          solutions = phase5Data[0]?.solutions || [];
          notes = phase5Data[0]?.notes || '';
        } else if (phase5Data && phase5Data.solutions) {
          // Direct object format: { solutions: [...] }
          solutions = phase5Data.solutions || [];
          notes = phase5Data.notes || '';
        } else {
          solutions = [];
          notes = '';
        }
        
        // Map solutions to database format
        if (solutions && solutions.length > 0) {
          updatedSession.phase5Solutions = solutions.map(sol => ({
            title: sol.title || '',
            summary: sol.summary || '',
            features: Array.isArray(sol.features) ? sol.features : [],
            limitations: Array.isArray(sol.limitations) ? sol.limitations : [sol.limitations || ''],
            targetUsers: sol.target_users || '',
            platformType: sol.platform_type || '',
            officialWebsite: sol.official_website || '',
            documentationLink: sol.documentation_link || '',
            pricingOrLicense: sol.pricing_or_license || ''
          }));
          
          updatedSession.phase5Notes = notes;
          updatedSession.markModified('phase5Solutions');
        }
        
        updatedSession.phases.phase5.n8nWebhookSent = true;
        updatedSession.phases.phase5.n8nResponse = phase5Response;
        updatedSession.phases.phase5.phase5Data = phase5Response.phase5Data;
        
        // Validate Phase 5 data before marking as completed
        const hasValidPhase5Data = updatedSession.phase5Solutions && 
                                    updatedSession.phase5Solutions.length > 0;
        
        if (hasValidPhase5Data) {
          updatedSession.phases.phase5.status = 'completed';
          updatedSession.phases.phase5.completedAt = new Date();
          updatedSession.progress = 85;
          updatedSession.overallStatus = 'processing';
          await updatedSession.save();
          
          console.log(`✅ Phase 5 completed successfully for chatId: ${chatId}`);
          
          // Automatically trigger Phase 6
          triggerPhase6(chatId, refinedProblem);
        } else {
          // No solutions found - mark Phase 5 as failed
          updatedSession.phases.phase5.status = 'failed';
          updatedSession.phases.phase5.completedAt = new Date();
          updatedSession.phases.phase5.error = 'Phase 5 completed but no solutions were found';
          updatedSession.progress = 75;
          await updatedSession.save();
          
          console.error(`❌ Phase 5 webhook responded but no solutions for chatId: ${chatId}`);
        }
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        updatedSession.phases.phase5.status = 'failed';
        updatedSession.phases.phase5.completedAt = new Date();
        updatedSession.phases.phase5.error = error.message;
        
        await updatedSession.save();
        
        console.error(`❌ Phase 5 failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase5:', error);
  }
};

/**
 * Trigger Phase 6: Generate best solution based on all analysis
 */
const triggerPhase6 = async (chatId, refinedProblem) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Check if Phase 6 is already completed with valid data
    if (session.phases.phase6.status === 'completed') {
      const hasValidData = session.phase6Solution && session.phase6Solution.proposedSolution;
      if (hasValidData) {
        console.log(`⏭️ Phase 6 already completed for chatId: ${chatId}, skipping...`);
        return;
      }
    }
    
    session.phases.phase6.status = 'processing';
    session.phases.phase6.startedAt = new Date();
    session.currentPhase = 6;
    session.progress = 90;
    
    await session.save();

    sendToPhase6Webhook(chatId, refinedProblem)
      .then(async (phase6Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        // Parse Phase 6 response - handle array with structuredOutput
        const phase6Data = phase6Response.phase6Data;
        
        let structuredOutput;
        if (Array.isArray(phase6Data) && phase6Data.length > 0) {
          structuredOutput = phase6Data[0]?.structuredOutput || phase6Data[0];
        } else if (phase6Data && typeof phase6Data === 'object') {
          structuredOutput = phase6Data.structuredOutput || phase6Data;
        } else {
          structuredOutput = null;
        }
        
        if (structuredOutput) {
          // Store all fields from new structure
          updatedSession.phase6Solution = {
            proposedSolution: structuredOutput.proposed_solution || '',
            problemUnderstanding: structuredOutput['Problem Understanding'] || '',
            solutionArchitecture: Array.isArray(structuredOutput['Solution Architecture & Approach']) 
              ? structuredOutput['Solution Architecture & Approach'] 
              : [],
            implementationWorkflow: Array.isArray(structuredOutput['Implementation Workflow']) 
              ? structuredOutput['Implementation Workflow'].map(phase => ({
                  phaseTitle: phase.phase_title || '',
                  steps: Array.isArray(phase.steps) ? phase.steps : []
                }))
              : [],
            recommendedTechStack: Array.isArray(structuredOutput['Recommended Tech Stack']) 
              ? structuredOutput['Recommended Tech Stack'].map(stack => ({
                  title: stack.title || '',
                  items: Array.isArray(stack.items) ? stack.items : []
                }))
              : [],
            scoringByFactors: Array.isArray(structuredOutput['Scoring by Factors']) 
              ? structuredOutput['Scoring by Factors'].map(score => ({
                  title: score.title || '',
                  rating: score.rating || 0,
                  description: score.description || ''
                }))
              : [],
            limitations: Array.isArray(structuredOutput['Limitations & Open Questions']) 
              ? structuredOutput['Limitations & Open Questions'] 
              : [],
            additionalInformation: Array.isArray(structuredOutput['Additional Information']) 
              ? structuredOutput['Additional Information'] 
              : []
          };
          
          updatedSession.markModified('phase6Solution');
        }
        
        updatedSession.phases.phase6.n8nWebhookSent = true;
        updatedSession.phases.phase6.n8nResponse = phase6Response;
        updatedSession.phases.phase6.phase6Data = phase6Response.phase6Data;
        
        // Validate Phase 6 data before marking as completed
        const hasValidPhase6Data = updatedSession.phase6Solution && 
                                    updatedSession.phase6Solution.proposedSolution;
        
        if (hasValidPhase6Data) {
          updatedSession.phases.phase6.status = 'completed';
          updatedSession.phases.phase6.completedAt = new Date();
          updatedSession.progress = 100;
          updatedSession.overallStatus = 'completed';
          await updatedSession.save();
          
          console.log(`✅ Phase 6 completed successfully for chatId: ${chatId}`);
        } else {
          // No solution proposal - mark Phase 6 as failed
          updatedSession.phases.phase6.status = 'failed';
          updatedSession.phases.phase6.completedAt = new Date();
          updatedSession.phases.phase6.error = 'Phase 6 completed but phase6Solution is missing or invalid';
          updatedSession.progress = 90;
          updatedSession.overallStatus = 'completed'; // Phase 5 was still successful
          await updatedSession.save();
          
          console.error(`❌ Phase 6 webhook responded but no valid solution for chatId: ${chatId}`);
        }
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId});
        
        updatedSession.phases.phase6.status = 'failed';
        updatedSession.phases.phase6.completedAt = new Date();
        updatedSession.phases.phase6.error = error.message;
        updatedSession.overallStatus = 'completed'; // Phase 5 was still successful
        updatedSession.progress = 100;
        
        await updatedSession.save();
        
        console.error(`❌ Phase 6 failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase6:', error);
  }
};

// ============= RETRY FUNCTIONS =============

/**
 * Retry Phase 1: Re-process prompt enhancement
 */
const triggerPhase1Retry = async (chatId, originalInput) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    session.phases.phase1.status = 'processing';
    session.phases.phase1.startedAt = new Date();
    session.currentPhase = 1;
    
    await session.save();

    sendToN8nWebhook(chatId, originalInput)
      .then(async (phase1Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        updatedSession.refinedProblem = phase1Response.refinedProblem || '';
        updatedSession.subtopics = phase1Response.subtopics || [];
        updatedSession.embedding = phase1Response.embedding || [];
        
        updatedSession.phases.phase1.status = 'completed';
        updatedSession.phases.phase1.completedAt = new Date();
        updatedSession.phases.phase1.n8nWebhookSent = true;
        updatedSession.phases.phase1.n8nResponse = phase1Response;
        updatedSession.progress = 10;
        
        await updatedSession.save();
        
        // Automatically trigger Phase 2
        triggerPhase2(chatId, updatedSession.refinedProblem, updatedSession.subtopics, updatedSession.embedding);
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        updatedSession.phases.phase1.status = 'failed';
        updatedSession.phases.phase1.error = error.message;
        await updatedSession.save();
        console.error(`❌ Phase 1 retry failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase1Retry:', error);
  }
};

/**
 * Retry Phase 2: Re-fetch research papers with duplicate removal
 */
const triggerPhase2Retry = async (chatId, refinedProblem, subtopics, embedding, deleteExisting) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    // Store existing papers for merge if not deleting
    const existingPapers = deleteExisting ? [] : [...session.papers];
    
    session.phases.phase2.status = 'processing';
    session.phases.phase2.startedAt = new Date();
    session.currentPhase = 2;
    
    await session.save();

    // Send with subtopics like the original Phase 2 trigger
    sendToPhase2Webhook(chatId, refinedProblem, subtopics, embedding)
      .then(async (phase2Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        const phase2Data = phase2Response.phase2Data || [];
        
        if (Array.isArray(phase2Data) && phase2Data.length > 0) {
          const newPapers = phase2Data.map(paper => ({
            title: paper.title || paper.paper_title || 'Untitled',
            authors: paper.authors || [],
            abstract: cleanAbstract(paper.abstract || ''),
            pdfLink: paper.pdf_url || paper.pdfLink || paper.pdf_link || '',
            semanticScore: paper.semantic_score || paper.semanticScore || 0,
            year: paper.year || new Date().getFullYear()
          }));

          // Merge and remove duplicates based on PDF link or title
          let mergedPapers;
          if (deleteExisting) {
            mergedPapers = newPapers;
          } else {
            mergedPapers = [...existingPapers];
            
            newPapers.forEach(newPaper => {
              const isDuplicate = existingPapers.some(existing => 
                (existing.pdfLink && newPaper.pdfLink && existing.pdfLink === newPaper.pdfLink) ||
                (existing.title && newPaper.title && existing.title.toLowerCase() === newPaper.title.toLowerCase())
              );
              
              if (!isDuplicate) {
                mergedPapers.push(newPaper);
              }
            });
          }
          
          updatedSession.papers = mergedPapers;
        }
        
        updatedSession.phases.phase2.n8nWebhookSent = true;
        updatedSession.phases.phase2.n8nResponse = phase2Response;
        updatedSession.phases.phase2.phase2Data = phase2Response.phase2Data;
        
        // Check if we have papers to process
        const pdfLinks = updatedSession.papers.map(p => p.pdfLink).filter(link => link);
        if (pdfLinks.length > 0) {
          updatedSession.phases.phase2.status = 'completed';
          updatedSession.phases.phase2.completedAt = new Date();
          updatedSession.progress = 25;
          await updatedSession.save();
          
          // Automatically trigger Phase 3
          triggerPhase3(chatId, pdfLinks);
        } else {
          // No papers found - mark Phase 2 as failed
          updatedSession.phases.phase2.status = 'failed';
          updatedSession.phases.phase2.completedAt = new Date();
          updatedSession.phases.phase2.error = 'No papers found with valid PDF links after retry';
          updatedSession.progress = 25;
          await updatedSession.save();
          
          console.error(`❌ Phase 2 retry completed but no papers found for chatId: ${chatId}`);
        }
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        updatedSession.phases.phase2.status = 'failed';
        updatedSession.phases.phase2.error = error.message;
        await updatedSession.save();
        console.error(`❌ Phase 2 retry failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase2Retry:', error);
  }
};

/**
 * Retry Phase 3: Re-analyze papers with duplicate removal
 */
const triggerPhase3Retry = async (chatId, papers, deleteExisting) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    // Store existing enriched papers for merge
    const existingPapers = deleteExisting ? [] : session.papers.filter(p => p.summary || p.methodology);
    
    session.phases.phase3.status = 'processing';
    session.phases.phase3.startedAt = new Date();
    session.currentPhase = 3;
    
    await session.save();

    // Extract PDF links only, same as original Phase 3 trigger
    const pdfLinks = papers.map(p => p.pdfLink).filter(link => link);

    sendToPhase3Webhook(chatId, pdfLinks)
      .then(async (phase3Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        const phase3Data = phase3Response.phase3Data || [];
        
        if (Array.isArray(phase3Data) && phase3Data.length > 0) {
          const newEnrichedPapers = [];
          
          phase3Data.forEach(analyzedPaper => {
            const pdfLink = analyzedPaper.pdf_link || analyzedPaper.pdfLink || analyzedPaper.pdf_url;
            const matchingPaper = updatedSession.papers.find(p => 
              p.pdfLink === pdfLink || 
              (p.title && analyzedPaper.title && p.title.toLowerCase() === analyzedPaper.title.toLowerCase())
            );
            
            if (matchingPaper && analyzedPaper.summary && analyzedPaper.methodology) {
              newEnrichedPapers.push({
                title: matchingPaper.title,
                authors: matchingPaper.authors,
                abstract: matchingPaper.abstract,
                pdfLink: matchingPaper.pdfLink,
                semanticScore: matchingPaper.semanticScore,
                year: matchingPaper.year,
                summary: analyzedPaper.summary,
                methodology: analyzedPaper.methodology,
                algorithmsUsed: analyzedPaper.algorithms_used || [],
                result: analyzedPaper.result || '',
                conclusion: analyzedPaper.conclusion || '',
                limitations: analyzedPaper.limitations || '',
                futureScope: analyzedPaper.future_scope || ''
              });
            }
          });

          // Merge and remove duplicates based on PDF link
          let mergedPapers;
          if (deleteExisting) {
            mergedPapers = newEnrichedPapers;
          } else {
            const paperMap = new Map();
            
            // Add existing papers
            existingPapers.forEach(paper => {
              paperMap.set(paper.pdfLink, paper);
            });
            
            // Add or update with new papers
            newEnrichedPapers.forEach(paper => {
              paperMap.set(paper.pdfLink, paper);
            });
            
            mergedPapers = Array.from(paperMap.values());
          }
          
          updatedSession.papers = mergedPapers;
        }
        
        updatedSession.phases.phase3.status = 'completed';
        updatedSession.phases.phase3.completedAt = new Date();
        updatedSession.phases.phase3.n8nWebhookSent = true;
        updatedSession.phases.phase3.n8nResponse = phase3Response;
        updatedSession.phases.phase3.phase3Data = phase3Response.phase3Data;
        updatedSession.progress = 55;
        
        await updatedSession.save();
        
        // Automatically trigger Phase 4
        triggerPhase4(chatId, updatedSession.refinedProblem);
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        updatedSession.phases.phase3.status = 'failed';
        updatedSession.phases.phase3.error = error.message;
        await updatedSession.save();
        console.error(`❌ Phase 3 retry failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase3Retry:', error);
  }
};

/**
 * Retry Phase 4: Re-analyze methodologies with merge option
 */
const triggerPhase4Retry = async (chatId, refinedProblem, deleteExisting) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    // Store existing analysis for merge
    const existingAnalysis = deleteExisting ? null : session.phase4Analysis;
    
    session.phases.phase4.status = 'processing';
    session.phases.phase4.startedAt = new Date();
    session.currentPhase = 4;
    
    await session.save();

    sendToPhase4Webhook(chatId, refinedProblem)
      .then(async (phase4Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        const phase4Data = phase4Response.phase4Data || [];
        
        if (Array.isArray(phase4Data) && phase4Data.length > 0) {
          const cleanedOutput = phase4Data[0]?.cleanedOutput;
          
          if (cleanedOutput) {
            let newAnalysis = {
              mostCommonMethodologies: cleanedOutput.most_common_methodologies || [],
              technologyOrAlgorithms: cleanedOutput.technology_or_algorithms || [],
              datasetsUsed: cleanedOutput.datasets_used || [],
              uniqueOrLessCommonApproaches: cleanedOutput.unique_or_less_common_approaches || []
            };

            // Merge with existing if not deleting
            if (!deleteExisting && existingAnalysis) {
              // Merge methodologies (remove duplicates by title)
              const methodMap = new Map();
              [...existingAnalysis.mostCommonMethodologies, ...newAnalysis.mostCommonMethodologies].forEach(m => {
                methodMap.set(m.title.toLowerCase(), m);
              });
              newAnalysis.mostCommonMethodologies = Array.from(methodMap.values());

              // Merge technologies (remove duplicates)
              newAnalysis.technologyOrAlgorithms = [...new Set([
                ...existingAnalysis.technologyOrAlgorithms,
                ...newAnalysis.technologyOrAlgorithms
              ])];

              // Merge datasets (remove duplicates)
              newAnalysis.datasetsUsed = [...new Set([
                ...existingAnalysis.datasetsUsed,
                ...newAnalysis.datasetsUsed
              ])];

              // Merge unique approaches (remove duplicates by title)
              const approachMap = new Map();
              [...existingAnalysis.uniqueOrLessCommonApproaches, ...newAnalysis.uniqueOrLessCommonApproaches].forEach(a => {
                approachMap.set(a.title.toLowerCase(), a);
              });
              newAnalysis.uniqueOrLessCommonApproaches = Array.from(approachMap.values());
            }
            
            updatedSession.phase4Analysis = newAnalysis;
          }
        }
        
        updatedSession.phases.phase4.status = 'completed';
        updatedSession.phases.phase4.completedAt = new Date();
        updatedSession.phases.phase4.n8nWebhookSent = true;
        updatedSession.phases.phase4.n8nResponse = phase4Response;
        updatedSession.phases.phase4.phase4Data = phase4Response.phase4Data;
        updatedSession.progress = 70;
        
        await updatedSession.save();
        
        // Automatically trigger Phase 5
        triggerPhase5(chatId, updatedSession.refinedProblem);
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        updatedSession.phases.phase4.status = 'failed';
        updatedSession.phases.phase4.error = error.message;
        await updatedSession.save();
        console.error(`❌ Phase 4 retry failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase4Retry:', error);
  }
};

/**
 * Retry Phase 5: Re-fetch solutions with merge option
 */
const triggerPhase5Retry = async (chatId, refinedProblem, deleteExisting) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    // Store existing solutions for merge
    const existingSolutions = deleteExisting ? [] : [...session.phase5Solutions];
    
    session.phases.phase5.status = 'processing';
    session.phases.phase5.startedAt = new Date();
    session.currentPhase = 5;
    
    await session.save();

    sendToPhase5Webhook(chatId, refinedProblem)
      .then(async (phase5Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        // Parse Phase 5 response - handle both array and direct object
        const phase5Data = phase5Response.phase5Data;
        
        let newSolutions, notes;
        if (Array.isArray(phase5Data) && phase5Data.length > 0) {
          // Array format: [{ solutions: [...] }]
          newSolutions = phase5Data[0]?.solutions || [];
          notes = phase5Data[0]?.notes || '';
        } else if (phase5Data && phase5Data.solutions) {
          // Direct object format: { solutions: [...] }
          newSolutions = phase5Data.solutions || [];
          notes = phase5Data.notes || '';
        } else {
          newSolutions = [];
          notes = '';
        }
        
        if (newSolutions && newSolutions.length > 0) {
          const mappedNewSolutions = newSolutions.map(sol => ({
              title: sol.title || '',
              summary: sol.summary || '',
              features: Array.isArray(sol.features) ? sol.features : [],
              limitations: Array.isArray(sol.limitations) ? sol.limitations : [sol.limitations || ''],
              targetUsers: sol.target_users || '',
              platformType: sol.platform_type || '',
              officialWebsite: sol.official_website || '',
              documentationLink: sol.documentation_link || '',
              pricingOrLicense: sol.pricing_or_license || ''
            }));

            // Merge and remove duplicates based on title and official website
            let mergedSolutions;
            if (deleteExisting) {
              mergedSolutions = mappedNewSolutions;
            } else {
              const solutionMap = new Map();
              
              // Add existing solutions
              existingSolutions.forEach(sol => {
                const key = `${sol.title.toLowerCase()}_${sol.officialWebsite}`;
                solutionMap.set(key, sol);
              });
              
              // Add or update with new solutions
              mappedNewSolutions.forEach(sol => {
                const key = `${sol.title.toLowerCase()}_${sol.officialWebsite}`;
                solutionMap.set(key, sol);
              });
              
              mergedSolutions = Array.from(solutionMap.values());
            }
            
            updatedSession.phase5Solutions = mergedSolutions;
            updatedSession.phase5Notes = notes;
            updatedSession.markModified('phase5Solutions');
          }
        
        updatedSession.phases.phase5.status = 'completed';
        updatedSession.phases.phase5.completedAt = new Date();
        updatedSession.phases.phase5.n8nWebhookSent = true;
        updatedSession.phases.phase5.n8nResponse = phase5Response;
        updatedSession.phases.phase5.phase5Data = phase5Response.phase5Data;
        updatedSession.progress = 85;
        
        await updatedSession.save();
        
        // Automatically trigger Phase 6
        triggerPhase6(chatId, updatedSession.refinedProblem);
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        updatedSession.phases.phase5.status = 'failed';
        updatedSession.phases.phase5.error = error.message;
        await updatedSession.save();
        console.error(`❌ Phase 5 retry failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase5Retry:', error);
  }
};

/**
 * Retry Phase 6: Re-generate best solution
 */
const triggerPhase6Retry = async (chatId, refinedProblem, deleteExisting) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    // Clear existing solution if deleteExisting is true
    if (deleteExisting) {
      session.phase6Solution = null;
    }
    
    session.phases.phase6.status = 'processing';
    session.phases.phase6.startedAt = new Date();
    session.currentPhase = 6;
    
    await session.save();

    sendToPhase6Webhook(chatId, refinedProblem)
      .then(async (phase6Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        const phase6Data = phase6Response.phase6Data;
        
        let structuredOutput;
        if (Array.isArray(phase6Data) && phase6Data.length > 0) {
          structuredOutput = phase6Data[0]?.structuredOutput || phase6Data[0];
        } else if (phase6Data && typeof phase6Data === 'object') {
          structuredOutput = phase6Data.structuredOutput || phase6Data;
        } else {
          structuredOutput = null;
        }
        
        if (structuredOutput) {
          updatedSession.phase6Solution = {
            proposedSolution: structuredOutput.proposed_solution || '',
            problemUnderstanding: structuredOutput['Problem Understanding'] || '',
            solutionArchitecture: Array.isArray(structuredOutput['Solution Architecture & Approach']) 
              ? structuredOutput['Solution Architecture & Approach'] 
              : [],
            implementationWorkflow: Array.isArray(structuredOutput['Implementation Workflow']) 
              ? structuredOutput['Implementation Workflow'].map(phase => ({
                  phaseTitle: phase.phase_title || '',
                  steps: Array.isArray(phase.steps) ? phase.steps : []
                }))
              : [],
            recommendedTechStack: Array.isArray(structuredOutput['Recommended Tech Stack']) 
              ? structuredOutput['Recommended Tech Stack'].map(stack => ({
                  title: stack.title || '',
                  items: Array.isArray(stack.items) ? stack.items : []
                }))
              : [],
            scoringByFactors: Array.isArray(structuredOutput['Scoring by Factors']) 
              ? structuredOutput['Scoring by Factors'].map(score => ({
                  title: score.title || '',
                  rating: score.rating || 0,
                  description: score.description || ''
                }))
              : [],
            limitations: Array.isArray(structuredOutput['Limitations & Open Questions']) 
              ? structuredOutput['Limitations & Open Questions'] 
              : [],
            additionalInformation: Array.isArray(structuredOutput['Additional Information']) 
              ? structuredOutput['Additional Information'] 
              : []
          };
          
          updatedSession.markModified('phase6Solution');
        }
        
        updatedSession.phases.phase6.status = 'completed';
        updatedSession.phases.phase6.completedAt = new Date();
        updatedSession.phases.phase6.n8nWebhookSent = true;
        updatedSession.phases.phase6.n8nResponse = phase6Response;
        updatedSession.phases.phase6.phase6Data = phase6Response.phase6Data;
        updatedSession.progress = 100;
        updatedSession.overallStatus = 'completed';
        
        await updatedSession.save();
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        updatedSession.phases.phase6.status = 'failed';
        updatedSession.phases.phase6.error = error.message;
        await updatedSession.save();
        console.error(`❌ Phase 6 retry failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    console.error('Error in triggerPhase6Retry:', error);
  }
};

