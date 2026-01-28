import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import ResearchSession from '../models/ResearchSession.model.js';
import User from '../models/user.model.js';
import { sendToN8nWebhook, sendToPhase2Webhook, sendToPhase2ApplicationsWebhook, sendToPhase2GitHubWebhook, sendToPhase3Webhook, sendToPhase3ResearchPaperWebhook, sendToPhase3GitHubWebhook, sendToPhase4Webhook, sendToPhase4ResearchPaperWebhook, sendToPhase4GitHubWebhook, sendToPhase4ApplicationWebhook, sendToPhase4GapFinderWebhook, sendToPhase5LiteratureReviewWebhook, sendToPhase6Webhook } from '../services/n8n.service.js';
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
        // Note: embeddings are not stored to save database space
        session.phases.phase1.n8nWebhookSent = true;
        session.phases.phase1.n8nResponse = n8nResponse;

        // Validate Phase 1 data before marking as completed
        const hasValidPhase1Data = n8nResponse.refinedProblem && 
                                    n8nResponse.subtopics && 
                                    n8nResponse.subtopics.length > 0;

        if (!hasValidPhase1Data) {
          // console.error(`❌ Phase 1 returned invalid data for chatId: ${chatId}`);
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

        // Automatically trigger Phase 2 (embeddings not stored)
        triggerPhase2(chatId, n8nResponse.refinedProblem, n8nResponse.subtopics);
      })
      .catch(async (error) => {
        // Handle n8n webhook error
        const session = await ResearchSession.findOne({ chatId });
        
        session.phases.phase1.status = 'failed';
        session.phases.phase1.completedAt = new Date();
        session.phases.phase1.error = error.message;
        session.overallStatus = 'failed';

        await session.save();

        // console.error(`❌ Phase 1 failed for chatId: ${chatId}`, error.message);
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
    // console.error('Error initiating research:', error);
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

    // Only select fields needed for status check and validation
    const session = await ResearchSession.findOne({ chatId })
      .select('chatId currentPhase overallStatus progress phases refinedProblem subtopics enhancedInput papers._id papers.pdfLink phase6Solution createdAt updatedAt');

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
        // console.warn(`⚠️ Auto-fixed Phase 1 status for chatId: ${chatId} - missing refinedProblem or subtopics`);
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
        // console.warn(`⚠️ Auto-fixed Phase 2 status for chatId: ${chatId} - no papers found`);
        await session.save();
      }
    }
    
    // Phase 3: Check at least one sub-phase completed
    if (session.phases.phase3.status === 'completed') {
      const paperAnalysisCompleted = session.phases.phase3.researchPaperAnalysis?.completed;
      const githubAnalysisCompleted = session.phases.phase3.githubAnalysis?.completed;
      const hasValidPhase3Data = paperAnalysisCompleted || githubAnalysisCompleted;
      
      if (!hasValidPhase3Data) {
        session.phases.phase3.status = 'failed';
        session.phases.phase3.error = 'Phase 3 was completed but neither sub-phase completed successfully. Please retry Phase 3.';
        wasFixed = true;
        // console.warn(`⚠️ Auto-fixed Phase 3 status for chatId: ${chatId} - no sub-phases completed`);
        await session.save();
      }
    }
    
    
    // Phase 4 removed - Phase 3 now triggers Phase 6 directly
    // Phase 5 removed - applications moved to Phase 2
    
    // Phase 6: Check phase6Solution exists
    if (session.phases.phase6.status === 'completed') {
      const hasValidPhase6Data = session.phase6Solution && 
                                  session.phase6Solution.proposedSolution;
      
      if (!hasValidPhase6Data) {
        session.phases.phase6.status = 'failed';
        session.phases.phase6.error = 'Phase 6 was completed but phase6Solution is missing. Please retry Phase 6.';
        wasFixed = true;
        // console.warn(`⚠️ Auto-fixed Phase 6 status for chatId: ${chatId} - no solution proposal`);
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
    // console.error('Error fetching session status:', error);
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

    // Exclude large internal response objects that are never displayed in UI
    const session = await ResearchSession.findOne({ chatId })
      .select('-phases.phase1.n8nResponse -phases.phase2.n8nResponse -phases.phase3.n8nResponse -phases.phase4.n8nResponse -phases.phase5.n8nResponse -phases.phase6.n8nResponse -phases.phase1.phase2Data -phases.phase2.response -phases.phase3.response -phases.phase4.response -phases.phase5.response -phases.phase6.response');

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
        // console.warn(`⚠️ Auto-fixed Phase 1 status for chatId: ${chatId} - missing refinedProblem or subtopics`);
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
        // console.warn(`⚠️ Auto-fixed Phase 2 status for chatId: ${chatId} - no papers found`);
      }
    }
    
    // Phase 3: Check at least one sub-phase completed
    if (session.phases.phase3.status === 'completed') {
      const paperAnalysisCompleted = session.phases.phase3.researchPaperAnalysis?.completed;
      const githubAnalysisCompleted = session.phases.phase3.githubAnalysis?.completed;
      const hasValidPhase3Data = paperAnalysisCompleted || githubAnalysisCompleted;
      
      if (!hasValidPhase3Data) {
        session.phases.phase3.status = 'failed';
        session.phases.phase3.error = 'Phase 3 was completed but neither sub-phase completed successfully. Please retry Phase 3.';
        needsSave = true;
        // console.warn(`⚠️ Auto-fixed Phase 3 status for chatId: ${chatId} - no sub-phases completed`);
      }
    }
    
    
    // Phase 4 removed - Phase 3 now triggers Phase 6 directly
    // Phase 5 removed - applications moved to Phase 2
    
    // Phase 6: Check phase6Solution exists
    if (session.phases.phase6.status === 'completed') {
      const hasValidPhase6Data = session.phase6Solution && 
                                  session.phase6Solution.proposedSolution;
      
      if (!hasValidPhase6Data) {
        session.phases.phase6.status = 'failed';
        session.phases.phase6.error = 'Phase 6 was completed but phase6Solution is missing. Please retry Phase 6.';
        needsSave = true;
        // console.warn(`⚠️ Auto-fixed Phase 6 status for chatId: ${chatId} - no solution proposal`);
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
    // console.error('Error fetching session details:', error);
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
          session.phase4GapAnalysis = null;
          break;
        case 5:
          // Phase 5 was removed - applications moved to Phase 2
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
        triggerFunction = () => triggerPhase2Retry(chatId, session.refinedProblem, session.subtopics, deleteExisting);
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
      case 7:
        return res.status(400).json({ error: 'Phase 7 (Chat) cannot be retried. It is an interactive phase.' });
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
    // console.error('Error in retryPhase:', error);
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

    // Check if database is connected
    if (!mongoose.connection.readyState) {
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable',
        details: 'Please check your database connection and try again'
      });
    }

    // Build query based on user email
    let query = {};
    if (userEmail) {
      const user = await User.findOne({ email: userEmail }).select('researchSessions').maxTimeMS(5000);
      if (user && user.researchSessions.length > 0) {
        query = { chatId: { $in: user.researchSessions } };
      } else {
        // User exists but has no sessions yet
        query = { chatId: { $in: [] } };
      }
    }

    // Only select fields needed for list view to improve performance
    const sessions = await ResearchSession.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('chatId originalInput overallStatus currentPhase progress createdAt')
      .lean() // Return plain JS objects instead of Mongoose documents (faster)
      .maxTimeMS(10000); // 10 second timeout

    const total = await ResearchSession.countDocuments(query).maxTimeMS(5000);

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
    // console.error('Error fetching sessions:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'MongoNetworkTimeoutError' || error.name === 'MongoTimeoutError') {
      return res.status(503).json({
        success: false,
        error: 'Database connection timeout',
        details: 'Unable to reach database. Please check your network connection.'
      });
    }

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

    // console.log(`🛑 Stop phase request - chatId: ${chatId}, phase: ${phase}`);

    if (!phase || phase < 1 || phase > 6) {
      // console.log(`❌ Invalid phase number: ${phase}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid phase number. Must be between 1 and 6'
      });
    }

    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      // console.log(`❌ Session not found: ${chatId}`);
      return res.status(404).json({
        success: false,
        error: 'Research session not found'
      });
    }

    const phaseKey = `phase${phase}`;
    const currentStatus = session.phases[phaseKey]?.status;

    // console.log(`📊 Current phase ${phase} status: ${currentStatus}`);

    // Only allow stopping phases that are in 'processing' state
    if (currentStatus !== 'processing') {
      // console.log(`⚠️ Cannot stop phase ${phase} - not in processing state (current: ${currentStatus})`);
      return res.status(400).json({
        success: false,
        error: `Phase ${phase} is not currently processing (status: ${currentStatus})`
      });
    }

    // Mark phase as pending (not completed)
    session.phases[phaseKey].status = 'pending';
    session.phases[phaseKey].error = null;
    session.phases[phaseKey].completedAt = null;

    await session.save();

    // console.log(`✅ Phase ${phase} stopped successfully - status set to pending`);

    res.status(200).json({
      success: true,
      message: `Phase ${phase} stopped successfully`,
      data: {
        chatId,
        phase,
        newStatus: 'pending'
      }
    });

  } catch (error) {
    // console.error('Error stopping phase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop phase',
      details: error.message
    });
  }
};

/**
 * Submit expected outcome after Phase 5 and trigger Phase 6
 */
export const submitExpectedOutcome = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { expectedOutcome } = req.body;

    if (!expectedOutcome || expectedOutcome.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Expected outcome is required'
      });
    }

    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Research session not found'
      });
    }

    // Verify Phase 5 is completed
    if (session.phases.phase5.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Phase 5 must be completed before submitting expected outcome'
      });
    }

    // Store expected outcome
    session.expectedOutcome = expectedOutcome.trim();
    await session.save();

    // console.log(`✅ Expected outcome received for chatId: ${chatId}`);
    // console.log(`📝 Expected outcome: ${expectedOutcome}`);

    // Trigger Phase 6 with expected outcome
    triggerPhase6(chatId, session.refinedProblem, expectedOutcome);

    res.status(200).json({
      success: true,
      message: 'Expected outcome submitted successfully. Phase 6 will start shortly.',
      data: {
        chatId,
        expectedOutcome
      }
    });

  } catch (error) {
    // console.error('Error submitting expected outcome:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit expected outcome',
      details: error.message
    });
  }
};

// Update expected outcome without triggering Phase 6 (for retries)
export const updateExpectedOutcome = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { expectedOutcome } = req.body;

    if (!expectedOutcome || expectedOutcome.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Expected outcome is required'
      });
    }

    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Research session not found'
      });
    }

    // Store expected outcome
    session.expectedOutcome = expectedOutcome.trim();
    await session.save();

    // console.log(`✅ Expected outcome updated for chatId: ${chatId}`);
    // console.log(`📝 Expected outcome: ${expectedOutcome}`);

    res.status(200).json({
      success: true,
      message: 'Expected outcome updated successfully.',
      data: {
        chatId,
        expectedOutcome
      }
    });

  } catch (error) {
    // console.error('Error updating expected outcome:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update expected outcome',
      details: error.message
    });
  }
};

// ============= WEBHOOK N8N TRIGGER FUNCTIONS ============

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
    // console.error('Error deleting session:', error);
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
 */
const triggerPhase2 = async (chatId, refinedProblem, subtopics) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      // console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Check if Phase 2 is already completed with valid data
    if (session.phases.phase2.status === 'completed') {
      const hasValidData = session.papers && session.papers.length > 0 && session.papers.some(p => p.pdfLink);
      if (hasValidData) {
        // console.log(`⏭️ Phase 2 already completed for chatId: ${chatId}, skipping...`);
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

    // Send 3 parallel requests to Phase 2 webhooks
    // console.log(`\u{1F680} Starting Phase 2 parallel requests for chatId: ${chatId}`);
    
    // Create promises for all 3 requests (embeddings not passed to save bandwidth)
    const papersPromise = sendToPhase2Webhook(chatId, refinedProblem, subtopics)
      .then(response => ({ type: 'papers', success: true, data: response }))
      .catch(error => ({ type: 'papers', success: false, error: error.message }));
    
    const applicationsPromise = sendToPhase2ApplicationsWebhook(chatId, refinedProblem)
      .then(response => ({ type: 'applications', success: true, data: response }))
      .catch(error => ({ type: 'applications', success: false, error: error.message }));
    
    const githubPromise = sendToPhase2GitHubWebhook(chatId, refinedProblem)
      .then(response => ({ type: 'github', success: true, data: response }))
      .catch(error => ({ type: 'github', success: false, error: error.message }));

    // Mark all as sent
    const updatedSession = await ResearchSession.findOne({ chatId });
    updatedSession.phases.phase2.papers.sent = true;
    updatedSession.phases.phase2.applications.sent = true;
    updatedSession.phases.phase2.github.sent = true;
    await updatedSession.save();

    // Wait for all 3 requests to complete
    Promise.allSettled([papersPromise, applicationsPromise, githubPromise])
      .then(async (results) => {
        const session = await ResearchSession.findOne({ chatId });
        
        let hasErrors = false;
        let hasPapers = false;
        
        // Process each result
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { type, success, data, error } = result.value;
            
            if (success) {
              // Handle papers response
              if (type === 'papers') {
                const papers = data.phase2Data || [];
                const formattedPapers = Array.isArray(papers) ? papers.map(paper => {
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
                
                session.papers = formattedPapers;
                session.phases.phase2.papers.completed = true;
                session.phases.phase2.papers.response = data;
                session.phases.phase2.papers.data = formattedPapers;
                
                if (formattedPapers.length > 0) {
                  hasPapers = true;
                }
              }
              
              // Handle applications response
              else if (type === 'applications') {
                const applicationsData = data.applicationsData;
                let solutions = [];
                let notes = '';
                
                if (Array.isArray(applicationsData) && applicationsData.length > 0) {
                  solutions = applicationsData[0]?.solutions || [];
                  notes = applicationsData[0]?.notes || '';
                } else if (applicationsData && applicationsData.solutions) {
                  solutions = applicationsData.solutions || [];
                  notes = applicationsData.notes || '';
                }
                
                if (solutions && solutions.length > 0) {
                  session.applications = solutions.map(sol => ({
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
                  
                  session.applicationsNotes = notes;
                }
                
                session.phases.phase2.applications.completed = true;
                session.phases.phase2.applications.response = data;
                session.phases.phase2.applications.data = applicationsData;
              }
              
              // Handle GitHub response
              else if (type === 'github') {
                const githubData = data.githubData;
                
                if (Array.isArray(githubData) && githubData.length > 0) {
                  // Store complete GitHub API response data
                  session.githubProjects = githubData;
                }
                
                session.phases.phase2.github.completed = true;
                session.phases.phase2.github.response = data;
                session.phases.phase2.github.data = githubData;
              }
            } else {
              // Handle errors
              hasErrors = true;
              if (type === 'papers') {
                session.phases.phase2.papers.error = error;
                // console.error(`\u{274C} Phase 2 Papers failed: ${error}`);
              } else if (type === 'applications') {
                session.phases.phase2.applications.error = error;
                // console.error(`\u{274C} Phase 2 Applications failed: ${error}`);
              } else if (type === 'github') {
                session.phases.phase2.github.error = error;
                // console.error(`\u{274C} Phase 2 GitHub failed: ${error}`);
              }
            }
          }
        }
        
        // Update overall Phase 2 status
        const papersCompleted = session.phases.phase2.papers.completed;
        const appsCompleted = session.phases.phase2.applications.completed;
        const githubCompleted = session.phases.phase2.github.completed;
        
        // Mark Phase 2 as completed if all 3 requests are done (even if some failed)
        if (papersCompleted && appsCompleted && githubCompleted) {
          session.phases.phase2.status = 'completed';
          session.phases.phase2.completedAt = new Date();
          session.progress = 45;
          
          // console.log(`✅ Phase 2 completed for chatId: ${chatId} - Triggering Phase 3`);
          await session.save();
          
          // Trigger Phase 3 (parallel analysis of papers and GitHub projects)
          triggerPhase3(chatId, []);
          return;
        } else {
          // At least one request is still pending - shouldn't happen with allSettled
          // console.log('🔄 Phase 2 still processing...');
        }
        
        await session.save();
      })
      .catch(async (error) => {
        const session = await ResearchSession.findOne({ chatId });
        
        session.phases.phase2.status = 'failed';
        session.phases.phase2.completedAt = new Date();
        session.phases.phase2.error = error.message;
        
        await session.save();
        
        // console.error(`\u{274C} Phase 2 failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    // console.error('Error in triggerPhase2:', error);
  }
};

/**
 * Trigger Phase 3 processing with 2 parallel analysis webhooks
 * @param {string} chatId - Unique chat identifier
 * @param {Array} pdfLinks - PDF links from Phase 2 (not used in new Phase 3, keeping for compatibility)
 */
const triggerPhase3 = async (chatId, pdfLinks) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      // console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Check if Phase 3 is already completed
    if (session.phases.phase3.status === 'completed') {
      // console.log(`⏭️ Phase 3 already completed for chatId: ${chatId}, skipping...`);
      // Trigger Phase 4 (Gap Finder) if not completed
      if (session.phases.phase4.status !== 'completed' && session.refinedProblem) {
        triggerPhase4(chatId, session.refinedProblem);
      }
      return;
    }

    // Update Phase 3 status to processing
    session.phases.phase3.status = 'processing';
    session.phases.phase3.startedAt = new Date();
    session.currentPhase = 3;
    session.progress = 45;
    
    await session.save();

    // console.log(`🚀 Starting Phase 3 parallel analysis for chatId: ${chatId}`);

    // Get data from Phase 2
    const papers = session.papers || [];
    const githubProjects = session.githubProjects || [];

    // Split papers into chunks of maximum 3 papers each
    const MAX_PAPERS_PER_CHUNK = 3;
    const paperChunks = [];
    for (let i = 0; i < papers.length; i += MAX_PAPERS_PER_CHUNK) {
      paperChunks.push(papers.slice(i, i + MAX_PAPERS_PER_CHUNK));
    }
    
    // Split GitHub projects into chunks using 4-3-3 pattern
    const githubChunks = [];
    if (githubProjects.length > 0) {
      const firstChunkSize = Math.min(4, githubProjects.length);
      githubChunks.push(githubProjects.slice(0, firstChunkSize));
      
      if (githubProjects.length > firstChunkSize) {
        const remainingProjects = githubProjects.slice(firstChunkSize);
        const secondChunkSize = Math.min(3, remainingProjects.length);
        githubChunks.push(remainingProjects.slice(0, secondChunkSize));
        
        if (remainingProjects.length > secondChunkSize) {
          githubChunks.push(remainingProjects.slice(secondChunkSize));
        }
      }
    }

    // console.log(`📚 Splitting ${papers.length} papers into ${paperChunks.length} chunks:`, paperChunks.map(c => c.length));
    // console.log(`🔧 Splitting ${githubProjects.length} GitHub projects into ${githubChunks.length} chunks:`, githubChunks.map(c => c.length));

    // Get refined problem from session
    const refinedProblem = session.refinedProblem || '';

    // Create promises for all paper analysis webhooks
    const paperAnalysisPromises = paperChunks.map((chunk, index) => 
      sendToPhase3ResearchPaperWebhook(chatId, chunk, index + 1, paperChunks.length, refinedProblem)
        .then(response => ({ type: 'paperAnalysis', chunk: index + 1, success: true, data: response }))
        .catch(error => ({ type: 'paperAnalysis', chunk: index + 1, success: false, error: error.message }))
    );
    
    // Create promises for all GitHub analysis webhooks
    const githubAnalysisPromises = githubChunks.map((chunk, index) =>
      sendToPhase3GitHubWebhook(chatId, chunk, index + 1, githubChunks.length, refinedProblem)
        .then(response => ({ type: 'githubAnalysis', chunk: index + 1, success: true, data: response }))
        .catch(error => ({ type: 'githubAnalysis', chunk: index + 1, success: false, error: error.message }))
    );

    // Combine all promises
    const allPromises = [...paperAnalysisPromises, ...githubAnalysisPromises];

    // Mark both as sent
    const updatedSession = await ResearchSession.findOne({ chatId });
    updatedSession.phases.phase3.researchPaperAnalysis.sent = true;
    updatedSession.phases.phase3.githubAnalysis.sent = true;
    await updatedSession.save();

    // Wait for all analyses to complete
    Promise.allSettled(allPromises)
      .then(async (results) => {
        const session = await ResearchSession.findOne({ chatId });
        
        let hasErrors = false;
        let combinedPaperAnalysis = [];
        let combinedGithubAnalysis = [];
        let paperChunksCompleted = 0;
        let githubChunksCompleted = 0;
        let paperErrors = [];
        let githubErrors = [];
        
        // Count total expected chunks
        const totalPaperChunks = paperChunks.length;
        const totalGithubChunks = githubChunks.length;
        
        // Process each result
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { type, chunk, success, data, error } = result.value;
            
            if (success) {
              // Handle paper analysis response
              if (type === 'paperAnalysis') {
                const analysisData = data.paperAnalysisData || [];
                
                // Combine paper analysis data from all chunks
                if (Array.isArray(analysisData)) {
                  combinedPaperAnalysis = combinedPaperAnalysis.concat(analysisData);
                }
                
                paperChunksCompleted++;
                // console.log(`✅ Phase 3 Research Paper Analysis Chunk ${chunk}/${totalPaperChunks} completed (${analysisData.length} papers)`);
                
                // Mark as completed when all chunks are done
                if (paperChunksCompleted === totalPaperChunks) {
                  session.phases.phase3.researchPaperAnalysis.completed = true;
                  session.phases.phase3.researchPaperAnalysis.response = { 
                    combined: true, 
                    totalPapers: combinedPaperAnalysis.length,
                    chunks: totalPaperChunks
                  };
                  session.phases.phase3.researchPaperAnalysis.data = combinedPaperAnalysis;
                  
                  // console.log(`✅ Phase 3 Research Paper Analysis FULLY completed (${combinedPaperAnalysis.length} total papers from ${totalPaperChunks} chunks)`);
                }
              }
              
              // Handle GitHub analysis response
              else if (type === 'githubAnalysis') {
                const analysisData = data.githubAnalysisData || [];
                
                // Combine GitHub analysis data from all chunks
                if (Array.isArray(analysisData)) {
                  combinedGithubAnalysis = combinedGithubAnalysis.concat(analysisData);
                }
                
                githubChunksCompleted++;
                // console.log(`✅ Phase 3 GitHub Analysis Chunk ${chunk}/${totalGithubChunks} completed (${analysisData.length} projects)`);
                
                // Mark as completed when all chunks are done
                if (githubChunksCompleted === totalGithubChunks) {
                  session.phases.phase3.githubAnalysis.completed = true;
                  session.phases.phase3.githubAnalysis.response = {
                    combined: true,
                    totalProjects: combinedGithubAnalysis.length,
                    chunks: totalGithubChunks
                  };
                  session.phases.phase3.githubAnalysis.data = combinedGithubAnalysis;
                  
                  // console.log(`✅ Phase 3 GitHub Analysis FULLY completed (${combinedGithubAnalysis.length} total projects from ${totalGithubChunks} chunks)`);
                }
              }
            } else {
              // Handle errors
              hasErrors = true;
              if (type === 'paperAnalysis') {
                paperErrors.push(`Chunk ${chunk}: ${error}`);
                // console.error(`❌ Phase 3 Research Paper Analysis Chunk ${chunk} failed: ${error}`);
                
                paperChunksCompleted++;
                // If all chunks processed and no data, mark as failed with errors
                if (paperChunksCompleted === totalPaperChunks) {
                  session.phases.phase3.researchPaperAnalysis.completed = true;
                  if (combinedPaperAnalysis.length === 0) {
                    session.phases.phase3.researchPaperAnalysis.error = paperErrors.join('; ');
                  } else {
                    session.phases.phase3.researchPaperAnalysis.response = { 
                      combined: true, 
                      totalPapers: combinedPaperAnalysis.length,
                      chunks: totalPaperChunks,
                      partialErrors: paperErrors
                    };
                    session.phases.phase3.researchPaperAnalysis.data = combinedPaperAnalysis;
                  }
                }
              } else if (type === 'githubAnalysis') {
                githubErrors.push(`Chunk ${chunk}: ${error}`);
                // console.error(`❌ Phase 3 GitHub Analysis Chunk ${chunk} failed: ${error}`);
                
                githubChunksCompleted++;
                // If all chunks processed and no data, mark as failed with errors
                if (githubChunksCompleted === totalGithubChunks) {
                  session.phases.phase3.githubAnalysis.completed = true;
                  if (combinedGithubAnalysis.length === 0) {
                    session.phases.phase3.githubAnalysis.error = githubErrors.join('; ');
                  } else {
                    session.phases.phase3.githubAnalysis.response = {
                      combined: true,
                      totalProjects: combinedGithubAnalysis.length,
                      chunks: totalGithubChunks,
                      partialErrors: githubErrors
                    };
                    session.phases.phase3.githubAnalysis.data = combinedGithubAnalysis;
                  }
                }
              }
            }
          }
        }
        
        // Update overall Phase 3 status
        const paperAnalysisCompleted = session.phases.phase3.researchPaperAnalysis.completed;
        const githubAnalysisCompleted = session.phases.phase3.githubAnalysis.completed;
        
        // console.log(`📊 Phase 3 Status Check for ${chatId}:`, { paperAnalysisCompleted, githubAnalysisCompleted, bothComplete: paperAnalysisCompleted && githubAnalysisCompleted });
        
        // Mark Phase 3 as completed if both analyses are done (even if some failed)
        if (paperAnalysisCompleted && githubAnalysisCompleted) {
          session.phases.phase3.status = 'completed';
          session.phases.phase3.completedAt = new Date();
          session.progress = 85;
          
          // console.log(`✅ Phase 3 completed for ${chatId}`, { paperCompleted: session.phases.phase3.researchPaperAnalysis.completed, githubCompleted: session.phases.phase3.githubAnalysis.completed });
          
          // Trigger Phase 4 (Gap Finder)
          await session.save();
          if (session.refinedProblem) {
            triggerPhase4(chatId, session.refinedProblem);
          }
          return;
        } else {
          // At least one analysis is still pending
          // console.log('🔄 Phase 3 still processing...');
        }
        
        await session.save();
      })
      .catch(async (error) => {
        const session = await ResearchSession.findOne({ chatId });
        
        session.phases.phase3.status = 'failed';
        session.phases.phase3.completedAt = new Date();
        session.phases.phase3.error = error.message;
        
        await session.save();
        
        // console.error(`❌ Phase 3 failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    // console.error('Error in triggerPhase3:', error);
  }
};

/**
 * Trigger Phase 4: Parallel analysis of research papers, GitHub projects, and applications
 * @param {string} chatId - Research session ID
 * @param {string} refinedProblem - Refined problem statement
 */
/**
 * Trigger Phase 4: Gap Finder - Analyze research gaps and opportunities
 */
const triggerPhase4 = async (chatId, refinedProblem) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      // console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Check if Phase 4 is already completed with valid data
    if (session.phases.phase4.status === 'completed') {
      const hasValidData = session.phase4GapAnalysis && 
                          (session.phase4GapAnalysis.evidence_based_gaps || 
                           session.phase4GapAnalysis.research_gaps_from_papers ||
                           session.phase4GapAnalysis.ai_predicted_possible_gaps);
      if (hasValidData) {
        // console.log(`⏭️ Phase 4 already completed for chatId: ${chatId}, skipping...`);
        // Trigger Phase 6 (Best Solution) if not completed
        if (session.phases.phase6.status !== 'completed' && session.refinedProblem) {
          triggerPhase6(chatId, session.refinedProblem);
        }
        return;
      }
    }
    
    session.phases.phase4.status = 'processing';
    session.phases.phase4.startedAt = new Date();
    session.currentPhase = 4;
    session.progress = 75;
    
    await session.save();

    // console.log(`🔍 Starting Phase 4 Gap Finder for chatId: ${chatId}`);

    sendToPhase4GapFinderWebhook(chatId, refinedProblem)
      .then(async (phase4Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        // Parse Phase 4 response
        const phase4Data = phase4Response.phase4Data;
        
        // console.log('📊 Phase 4 Raw Data:', JSON.stringify(phase4Data, null, 2));
        
        let gapAnalysis;
        if (Array.isArray(phase4Data) && phase4Data.length > 0) {
          gapAnalysis = phase4Data[0];
        } else if (phase4Data && typeof phase4Data === 'object') {
          gapAnalysis = phase4Data;
        } else {
          gapAnalysis = null;
        }
        
        if (gapAnalysis) {
          // Store gap analysis data with the actual structure from webhook
          updatedSession.phase4GapAnalysis = {
            evidence_based_gaps: gapAnalysis.evidence_based_gaps || [],
            research_gaps_from_papers: gapAnalysis.research_gaps_from_papers || [],
            ai_predicted_possible_gaps: gapAnalysis.ai_predicted_possible_gaps || [],
            confidence_level: gapAnalysis.confidence_level || 'MEDIUM',
            note: gapAnalysis.note || ''
          };
          
          updatedSession.phases.phase4.status = 'completed';
          updatedSession.phases.phase4.completedAt = new Date();
          updatedSession.phases.phase4.n8nResponse = phase4Response;
          updatedSession.progress = 80;
          
          await updatedSession.save();
          
          // console.log(`✅ Phase 4 completed successfully for chatId: ${chatId}`);
          // console.log(`📊 Stored ${gapAnalysis.evidence_based_gaps?.length || 0} evidence-based gaps, ${gapAnalysis.research_gaps_from_papers?.length || 0} research gaps from papers, and ${gapAnalysis.ai_predicted_possible_gaps?.length || 0} AI-predicted gaps`);
          
          // Trigger Phase 5 (Literature Review)
          triggerPhase5(chatId, updatedSession.refinedProblem);
        } else {
          throw new Error('Phase 4 returned invalid or empty data');
        }
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        updatedSession.phases.phase4.status = 'failed';
        updatedSession.phases.phase4.completedAt = new Date();
        updatedSession.phases.phase4.error = error.message;
        updatedSession.overallStatus = 'failed';
        
        await updatedSession.save();
        
        // console.error(`❌ Phase 4 failed for chatId: ${chatId}`, error.message);
      });
  } catch (error) {
    // console.error('Error triggering Phase 4:', error);
  }
};

/**
 * Trigger Phase 5: Literature Review
 */
const triggerPhase5 = async (chatId, refinedProblem) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      // console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Check if Phase 5 is already completed with valid data
    if (session.phases.phase5.status === 'completed') {
      const hasValidData = session.phase5LiteratureReview && session.phase5LiteratureReview.length > 0;
      if (hasValidData) {
        // console.log(`⏭️ Phase 5 already completed for chatId: ${chatId}, skipping...`);
        // Trigger Phase 6 (Best Solution) if not completed
        if (session.phases.phase6.status !== 'completed' && session.refinedProblem) {
          triggerPhase6(chatId, session.refinedProblem);
        }
        return;
      }
    }
    
    session.phases.phase5.status = 'processing';
    session.phases.phase5.startedAt = new Date();
    session.currentPhase = 5;
    session.progress = 85;
    
    await session.save();

    // console.log(`📚 Starting Phase 5 Literature Review for chatId: ${chatId}`);

    sendToPhase5LiteratureReviewWebhook(chatId, refinedProblem)
      .then(async (phase5Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        // Parse Phase 5 response
        const phase5Data = phase5Response.phase5Data;
        
        // console.log('📊 Phase 5 Raw Data:', JSON.stringify(phase5Data, null, 2));
        
        // Store literature review data
        updatedSession.phase5LiteratureReview = phase5Data || [];
        updatedSession.phases.phase5.status = 'completed';
        updatedSession.phases.phase5.completedAt = new Date();
        updatedSession.phases.phase5.n8nResponse = phase5Response;
        updatedSession.progress = 90;
        
        await updatedSession.save();
        
        // console.log(`✅ Phase 5 completed successfully for chatId: ${chatId}`);
        // console.log(`⏸️ Waiting for user to provide expected outcome before starting Phase 6`);
        
        // Phase 6 will be triggered manually after user provides expected outcome
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        updatedSession.phases.phase5.status = 'failed';
        updatedSession.phases.phase5.completedAt = new Date();
        updatedSession.phases.phase5.error = error.message;
        updatedSession.overallStatus = 'failed';
        
        await updatedSession.save();
        
        // console.error(`❌ Phase 5 failed for chatId: ${chatId}`, error.message);
      });
  } catch (error) {
    // console.error('Error triggering Phase 5:', error);
  }
};

/**
 * Trigger Phase 6: Generate best solution based on all analysis
 * Phase 4 & 5 removed - Phase 3 now triggers Phase 4, then Phase 4 triggers Phase 6
 */
const triggerPhase6 = async (chatId, refinedProblem, expectedOutcome = '') => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      // console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Check if Phase 6 is already completed with valid data
    if (session.phases.phase6.status === 'completed') {
      const hasValidData = session.phase6Solution && session.phase6Solution.proposedSolution;
      if (hasValidData) {
        // console.log(`⏭️ Phase 6 already completed for chatId: ${chatId}, skipping...`);
        return;
      }
    }
    
    session.phases.phase6.status = 'processing';
    session.phases.phase6.startedAt = new Date();
    session.currentPhase = 6;
    session.progress = 90;
    
    await session.save();

    // console.log(`🏆 Starting Phase 6 with expected outcome: ${expectedOutcome || 'None provided'}`);

    sendToPhase6Webhook(chatId, refinedProblem, expectedOutcome)
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
          
          // console.log(`✅ Phase 6 completed successfully for chatId: ${chatId}`);
        } else {
          // No solution proposal - mark Phase 6 as failed
          updatedSession.phases.phase6.status = 'failed';
          updatedSession.phases.phase6.completedAt = new Date();
          updatedSession.phases.phase6.error = 'Phase 6 completed but phase6Solution is missing or invalid';
          updatedSession.progress = 90;
          updatedSession.overallStatus = 'completed'; // Phase 5 was still successful
          await updatedSession.save();
          
          // console.error(`❌ Phase 6 webhook responded but no valid solution for chatId: ${chatId}`);
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
        
        // console.error(`❌ Phase 6 failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    // console.error('Error in triggerPhase6:', error);
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
        // Note: embeddings are not stored to save database space
        
        updatedSession.phases.phase1.status = 'completed';
        updatedSession.phases.phase1.completedAt = new Date();
        updatedSession.phases.phase1.n8nWebhookSent = true;
        updatedSession.phases.phase1.n8nResponse = phase1Response;
        updatedSession.progress = 15;
        
        await updatedSession.save();
        
        // Automatically trigger Phase 2 (embeddings not stored)
        triggerPhase2(chatId, updatedSession.refinedProblem, updatedSession.subtopics);
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        updatedSession.phases.phase1.status = 'failed';
        updatedSession.phases.phase1.error = error.message;
        await updatedSession.save();
        // console.error(`❌ Phase 1 retry failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    // console.error('Error in triggerPhase1Retry:', error);
  }
};

/**
 * Retry Phase 2: Re-fetch research papers with duplicate removal
 */
const triggerPhase2Retry = async (chatId, refinedProblem, subtopics, deleteExisting) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    // Store existing papers for merge if not deleting
    const existingPapers = deleteExisting ? [] : [...session.papers];
    
    session.phases.phase2.status = 'processing';
    session.phases.phase2.startedAt = new Date();
    session.currentPhase = 2;
    
    await session.save();

    // Send with subtopics (embeddings not stored)
    sendToPhase2Webhook(chatId, refinedProblem, subtopics)
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
          updatedSession.progress = 45;
          await updatedSession.save();
          
          // Automatically trigger Phase 3
          triggerPhase3(chatId, pdfLinks);
        } else {
          // No papers found - mark Phase 2 as failed
          updatedSession.phases.phase2.status = 'failed';
          updatedSession.phases.phase2.completedAt = new Date();
          updatedSession.phases.phase2.error = 'No papers found with valid PDF links after retry';
          updatedSession.progress = 45;
          await updatedSession.save();
          
          // console.error(`❌ Phase 2 retry completed but no papers found for chatId: ${chatId}`);
        }
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        updatedSession.phases.phase2.status = 'failed';
        updatedSession.phases.phase2.error = error.message;
        await updatedSession.save();
        // console.error(`❌ Phase 2 retry failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    // console.error('Error in triggerPhase2Retry:', error);
  }
};

/**
 * Retry Phase 3: Re-analyze papers with duplicate removal
 */
const triggerPhase3Retry = async (chatId, papers, deleteExisting) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      // console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Reset Phase 3 status and sub-phases
    session.phases.phase3.status = 'processing';
    session.phases.phase3.startedAt = new Date();
    session.phases.phase3.researchPaperAnalysis = {
      sent: false,
      completed: false,
      error: null,
      response: null,
      data: null
    };
    session.phases.phase3.githubAnalysis = {
      sent: false,
      completed: false,
      error: null,
      response: null,
      data: null
    };
    session.currentPhase = 3;
    session.progress = 45;
    
    await session.save();

    // console.log(`🔄 Retrying Phase 3 parallel analysis for chatId: ${chatId}`);

    // Get data from Phase 2
    const papersData = session.papers || [];
    const githubProjects = session.githubProjects || [];

    // Split papers into chunks of maximum 3 papers each
    const MAX_PAPERS_PER_CHUNK = 3;
    const paperChunks = [];
    for (let i = 0; i < papersData.length; i += MAX_PAPERS_PER_CHUNK) {
      paperChunks.push(papersData.slice(i, i + MAX_PAPERS_PER_CHUNK));
    }
    
    // Split GitHub projects into chunks using 4-3-3 pattern
    const githubChunks = [];
    if (githubProjects.length > 0) {
      const firstChunkSize = Math.min(4, githubProjects.length);
      githubChunks.push(githubProjects.slice(0, firstChunkSize));
      
      if (githubProjects.length > firstChunkSize) {
        const remainingProjects = githubProjects.slice(firstChunkSize);
        const secondChunkSize = Math.min(3, remainingProjects.length);
        githubChunks.push(remainingProjects.slice(0, secondChunkSize));
        
        if (remainingProjects.length > secondChunkSize) {
          githubChunks.push(remainingProjects.slice(secondChunkSize));
        }
      }
    }

    // console.log(`📚 Retry: Splitting ${papersData.length} papers into ${paperChunks.length} chunks:`, paperChunks.map(c => c.length));
    // console.log(`🔧 Retry: Splitting ${githubProjects.length} GitHub projects into ${githubChunks.length} chunks:`, githubChunks.map(c => c.length));

    // Get refined problem from session
    const refinedProblem = session.refinedProblem || '';

    // Create promises for all paper analysis webhooks
    const paperAnalysisPromises = paperChunks.map((chunk, index) => 
      sendToPhase3ResearchPaperWebhook(chatId, chunk, index + 1, paperChunks.length, refinedProblem)
        .then(response => ({ type: 'paperAnalysis', chunk: index + 1, success: true, data: response }))
        .catch(error => ({ type: 'paperAnalysis', chunk: index + 1, success: false, error: error.message }))
    );
    
    // Create promises for all GitHub analysis webhooks
    const githubAnalysisPromises = githubChunks.map((chunk, index) =>
      sendToPhase3GitHubWebhook(chatId, chunk, index + 1, githubChunks.length, refinedProblem)
        .then(response => ({ type: 'githubAnalysis', chunk: index + 1, success: true, data: response }))
        .catch(error => ({ type: 'githubAnalysis', chunk: index + 1, success: false, error: error.message }))
    );

    // Combine all promises
    const allPromises = [...paperAnalysisPromises, ...githubAnalysisPromises];

    // Mark both as sent
    const updatedSession = await ResearchSession.findOne({ chatId });
    updatedSession.phases.phase3.researchPaperAnalysis.sent = true;
    updatedSession.phases.phase3.githubAnalysis.sent = true;
    await updatedSession.save();

    // Wait for all analyses to complete
    Promise.allSettled(allPromises)
      .then(async (results) => {
        const session = await ResearchSession.findOne({ chatId });
        
        let combinedPaperAnalysis = [];
        let combinedGithubAnalysis = [];
        let paperChunksCompleted = 0;
        let githubChunksCompleted = 0;
        let paperErrors = [];
        let githubErrors = [];
        
        // Count total expected chunks
        const totalPaperChunks = paperChunks.length;
        const totalGithubChunks = githubChunks.length;
        
        // Process each result
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { type, chunk, success, data, error } = result.value;
            
            if (success) {
              if (type === 'paperAnalysis') {
                const analysisData = data.paperAnalysisData || [];
                
                // Combine paper analysis data from all chunks
                if (Array.isArray(analysisData)) {
                  combinedPaperAnalysis = combinedPaperAnalysis.concat(analysisData);
                }
                
                paperChunksCompleted++;
                // console.log(`✅ Phase 3 Research Paper Analysis Retry Chunk ${chunk}/${totalPaperChunks} completed (${analysisData.length} papers)`);
                
                // Mark as completed when all chunks are done
                if (paperChunksCompleted === totalPaperChunks) {
                  session.phases.phase3.researchPaperAnalysis.completed = true;
                  session.phases.phase3.researchPaperAnalysis.response = { 
                    combined: true, 
                    totalPapers: combinedPaperAnalysis.length,
                    chunks: totalPaperChunks
                  };
                  session.phases.phase3.researchPaperAnalysis.data = combinedPaperAnalysis;
                  
                  // console.log(`✅ Phase 3 Research Paper Analysis Retry FULLY completed (${combinedPaperAnalysis.length} total papers from ${totalPaperChunks} chunks)`);
                }
              }
              else if (type === 'githubAnalysis') {
                const analysisData = data.githubAnalysisData || [];
                
                // Combine GitHub analysis data from all chunks
                if (Array.isArray(analysisData)) {
                  combinedGithubAnalysis = combinedGithubAnalysis.concat(analysisData);
                }
                
                githubChunksCompleted++;
                // console.log(`✅ Phase 3 GitHub Analysis Retry Chunk ${chunk}/${totalGithubChunks} completed (${analysisData.length} projects)`);
                
                // Mark as completed when all chunks are done
                if (githubChunksCompleted === totalGithubChunks) {
                  session.phases.phase3.githubAnalysis.completed = true;
                  session.phases.phase3.githubAnalysis.response = {
                    combined: true,
                    totalProjects: combinedGithubAnalysis.length,
                    chunks: totalGithubChunks
                  };
                  session.phases.phase3.githubAnalysis.data = combinedGithubAnalysis;
                  
                  // console.log(`✅ Phase 3 GitHub Analysis Retry FULLY completed (${combinedGithubAnalysis.length} total projects from ${totalGithubChunks} chunks)`);
                }
              }
            } else {
              if (type === 'paperAnalysis') {
                paperErrors.push(`Chunk ${chunk}: ${error}`);
                // console.error(`❌ Phase 3 Research Paper Analysis Retry Chunk ${chunk} failed: ${error}`);
                
                paperChunksCompleted++;
                // If all chunks processed, mark as completed
                if (paperChunksCompleted === totalPaperChunks) {
                  session.phases.phase3.researchPaperAnalysis.completed = true;
                  if (combinedPaperAnalysis.length === 0) {
                    session.phases.phase3.researchPaperAnalysis.error = paperErrors.join('; ');
                  } else {
                    session.phases.phase3.researchPaperAnalysis.response = { 
                      combined: true, 
                      totalPapers: combinedPaperAnalysis.length,
                      chunks: totalPaperChunks,
                      partialErrors: paperErrors
                    };
                    session.phases.phase3.researchPaperAnalysis.data = combinedPaperAnalysis;
                  }
                }
              } else if (type === 'githubAnalysis') {
                githubErrors.push(`Chunk ${chunk}: ${error}`);
                // console.error(`❌ Phase 3 GitHub Analysis Retry Chunk ${chunk} failed: ${error}`);
                
                githubChunksCompleted++;
                // If all chunks processed, mark as completed
                if (githubChunksCompleted === totalGithubChunks) {
                  session.phases.phase3.githubAnalysis.completed = true;
                  if (combinedGithubAnalysis.length === 0) {
                    session.phases.phase3.githubAnalysis.error = githubErrors.join('; ');
                  } else {
                    session.phases.phase3.githubAnalysis.response = {
                      combined: true,
                      totalProjects: combinedGithubAnalysis.length,
                      chunks: totalGithubChunks,
                      partialErrors: githubErrors
                    };
                    session.phases.phase3.githubAnalysis.data = combinedGithubAnalysis;
                  }
                }
              }
            }
          }
        }
        
        // Check completion
        const paperAnalysisCompleted = session.phases.phase3.researchPaperAnalysis.completed;
        const githubAnalysisCompleted = session.phases.phase3.githubAnalysis.completed;
        
        // console.log(`📊 Phase 3 Retry Status Check for ${chatId}:`, { paperAnalysisCompleted, githubAnalysisCompleted, bothComplete: paperAnalysisCompleted && githubAnalysisCompleted });
        
        if (paperAnalysisCompleted && githubAnalysisCompleted) {
          session.phases.phase3.status = 'completed';
          session.phases.phase3.completedAt = new Date();
          session.progress = 85;
          
          // console.log(`✅ Phase 3 retry completed for ${chatId}`, { paperCompleted: session.phases.phase3.researchPaperAnalysis.completed, githubCompleted: session.phases.phase3.githubAnalysis.completed, status: session.phases.phase3.status });
          
          await session.save();
          
          // console.log(`💾 Phase 3 data saved to DB for ${chatId}`);
          
          // Trigger Phase 4 (Gap Finder)
          if (session.refinedProblem) {
            triggerPhase4(chatId, session.refinedProblem);
          }
        } else {
          // console.log('🔄 Phase 3 retry still processing...');
          await session.save();
        }
      })
      .catch(async (error) => {
        const session = await ResearchSession.findOne({ chatId });
        session.phases.phase3.status = 'failed';
        session.phases.phase3.completedAt = new Date();
        session.phases.phase3.error = error.message;
        await session.save();
        // console.error(`❌ Phase 3 retry failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    // console.error('Error in triggerPhase3Retry:', error);
  }
};

/**
 * Retry Phase 4: Re-run gap analysis
 */
const triggerPhase4Retry = async (chatId, refinedProblem, deleteExisting) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      // console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Clear Phase 4 data if requested
    if (deleteExisting) {
      session.phase4GapAnalysis = null;
      // console.log(`🗑️ Cleared Phase 4 data for chatId: ${chatId}`);
    }

    // Reset phase status
    session.phases.phase4.status = 'processing';
    session.phases.phase4.startedAt = new Date();
    session.phases.phase4.completedAt = null;
    session.phases.phase4.error = null;
    session.currentPhase = 4;
    session.progress = 75;
    
    await session.save();

    // console.log(`🔄 Retrying Phase 4 Gap Finder for chatId: ${chatId}`);

    // Call Phase 4 webhook
    sendToPhase4GapFinderWebhook(chatId, refinedProblem)
      .then(async (phase4Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        // Parse Phase 4 response
        const phase4Data = phase4Response.phase4Data;
        
        // console.log('📊 Phase 4 Retry Raw Data:', JSON.stringify(phase4Data, null, 2));
        
        let gapAnalysis;
        if (Array.isArray(phase4Data) && phase4Data.length > 0) {
          gapAnalysis = phase4Data[0];
        } else if (phase4Data && typeof phase4Data === 'object') {
          gapAnalysis = phase4Data;
        } else {
          gapAnalysis = null;
        }
        
        if (gapAnalysis) {
          // Store gap analysis data with the actual structure from webhook
          updatedSession.phase4GapAnalysis = {
            evidence_based_gaps: gapAnalysis.evidence_based_gaps || [],
            research_gaps_from_papers: gapAnalysis.research_gaps_from_papers || [],
            ai_predicted_possible_gaps: gapAnalysis.ai_predicted_possible_gaps || [],
            confidence_level: gapAnalysis.confidence_level || 'MEDIUM',
            note: gapAnalysis.note || ''
          };
          
          updatedSession.phases.phase4.status = 'completed';
          updatedSession.phases.phase4.completedAt = new Date();
          updatedSession.phases.phase4.n8nResponse = phase4Response;
          updatedSession.progress = 80;
          
          await updatedSession.save();
          
          // console.log(`✅ Phase 4 retry completed successfully for chatId: ${chatId}`);
          // console.log(`📊 Stored ${gapAnalysis.evidence_based_gaps?.length || 0} evidence-based gaps, ${gapAnalysis.research_gaps_from_papers?.length || 0} research gaps from papers, and ${gapAnalysis.ai_predicted_possible_gaps?.length || 0} AI-predicted gaps`);
          
          // Trigger Phase 5 (Literature Review) if not completed
          if (updatedSession.phases.phase5.status !== 'completed') {
            triggerPhase5(chatId, updatedSession.refinedProblem);
          }
        } else {
          throw new Error('Phase 4 returned invalid or empty data');
        }
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        updatedSession.phases.phase4.status = 'failed';
        updatedSession.phases.phase4.completedAt = new Date();
        updatedSession.phases.phase4.error = error.message;
        
        await updatedSession.save();
        
        // console.error(`❌ Phase 4 retry failed for chatId: ${chatId}`, error.message);
      });
  } catch (error) {
    // console.error('Error in triggerPhase4Retry:', error);
  }
};

/**
 * Retry Phase 5: Re-run Literature Review
 */
const triggerPhase5Retry = async (chatId, refinedProblem, deleteExisting) => {
  try {
    const session = await ResearchSession.findOne({ chatId });
    
    if (!session) {
      // console.error(`Session not found for chatId: ${chatId}`);
      return;
    }

    // Clear Phase 5 data if requested
    if (deleteExisting) {
      session.phase5LiteratureReview = null;
      // console.log(`🗑️ Cleared Phase 5 data for chatId: ${chatId}`);
    }

    // Reset phase status
    session.phases.phase5.status = 'processing';
    session.phases.phase5.startedAt = new Date();
    session.phases.phase5.completedAt = null;
    session.phases.phase5.error = null;
    session.currentPhase = 5;
    session.progress = 85;
    
    await session.save();

    // console.log(`🔄 Retrying Phase 5 Literature Review for chatId: ${chatId}`);

    // Call Phase 5 webhook
    sendToPhase5LiteratureReviewWebhook(chatId, refinedProblem)
      .then(async (phase5Response) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        // Parse Phase 5 response
        const phase5Data = phase5Response.phase5Data;
        
        // console.log('📊 Phase 5 Retry Raw Data:', JSON.stringify(phase5Data, null, 2));
        
        // Store literature review data
        updatedSession.phase5LiteratureReview = phase5Data || [];
        updatedSession.phases.phase5.status = 'completed';
        updatedSession.phases.phase5.completedAt = new Date();
        updatedSession.phases.phase5.n8nResponse = phase5Response;
        updatedSession.progress = 90;
        
        await updatedSession.save();
        
        // console.log(`✅ Phase 5 retry completed successfully for chatId: ${chatId}`);
        // console.log(`⏸️ Waiting for user to provide expected outcome before starting Phase 6`);
        
        // Phase 6 will be triggered manually after user provides expected outcome
      })
      .catch(async (error) => {
        const updatedSession = await ResearchSession.findOne({ chatId });
        
        updatedSession.phases.phase5.status = 'failed';
        updatedSession.phases.phase5.completedAt = new Date();
        updatedSession.phases.phase5.error = error.message;
        
        await updatedSession.save();
        
        // console.error(`❌ Phase 5 retry failed for chatId: ${chatId}`, error.message);
      });
  } catch (error) {
    // console.error('Error in triggerPhase5Retry:', error);
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

    // Use stored expectedOutcome from session
    const expectedOutcome = session.expectedOutcome || '';
    // console.log(`🔄 Retrying Phase 6 with expected outcome: ${expectedOutcome || 'None provided'}`);

    sendToPhase6Webhook(chatId, refinedProblem, expectedOutcome)
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
        // console.error(`❌ Phase 6 retry failed for chatId: ${chatId}`, error.message);
      });

  } catch (error) {
    // console.error('Error in triggerPhase6Retry:', error);
  }
};

