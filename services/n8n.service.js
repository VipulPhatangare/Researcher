import axios from 'axios';
import http from 'http';
import https from 'https';

/**
 * Send problem statement to n8n webhook for prompt enhancement
 * @param {string} chatId - Unique chat identifier
 * @param {string} problemStatement - Original problem statement
 * @returns {Promise<object>} Enhanced prompt response from n8n
 */
export const sendToN8nWebhook = async (chatId, problemStatement) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE1_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE1_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      originalInput: problemStatement,
      timestamp: new Date().toISOString(),
      phase: 1,
      action: 'enhance_prompt'
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 150000 // 30 second timeout
    });

    // Parse the response - n8n returns an array
    const result = Array.isArray(response.data) ? response.data[0] : response.data;
    
    // console.log('📥 Phase 1 Raw Response:', { ... });
    
    return {
      success: true,
      enhancedPrompt: result.refine_problem || result.refined_problem || result.enhancedPrompt,
      refinedProblem: result.refine_problem || result.refined_problem,
      subtopics: result.subtopics || [],
      // Note: embedding is available in n8n response but not stored to save database space
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ n8n webhook error:', error.message);

    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      throw new Error('n8n webhook request timed out');
    }

    if (error.response) {
      throw new Error(`n8n webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('n8n webhook request failed - no response received');
    }

    throw new Error(`n8n webhook error: ${error.message}`);
  }
};

/**
 * Send Phase 1 output to Phase 2 n8n webhook
 * @param {string} chatId - Unique chat identifier
 * @param {string} refinedProblem - Refined problem statement from Phase 1
 * @param {Array} subtopics - Subtopics array from Phase 1
 * @returns {Promise<object>} Phase 2 response from n8n
 */
export const sendToPhase2Webhook = async (chatId, refinedProblem, subtopics) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE2_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE2_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refined_problem: refinedProblem,
      subtopics: subtopics,
      // Note: embedding not sent to save bandwidth
      timestamp: new Date().toISOString(),
      phase: 2,
      action: 'process_research'
    };

    // Normalize subtopics - handle both string arrays and object arrays
    let normalizedSubtopics = subtopics;
    if (Array.isArray(subtopics) && subtopics.length > 0) {
      // If first element is a string, convert to object format
      if (typeof subtopics[0] === 'string') {
        normalizedSubtopics = subtopics.map((topic, index) => ({
          subtopic_id: index + 1,
          title: topic,
          description: topic,
          keywords: [topic]
        }));
      }
      // If objects but missing expected fields, normalize them
      else if (typeof subtopics[0] === 'object' && !subtopics[0].title) {
        normalizedSubtopics = subtopics.map((topic, index) => ({
          subtopic_id: topic.subtopic_id || index + 1,
          title: topic.title || topic.subtopic || topic.name || 'Untitled',
          description: topic.description || topic.title || topic.subtopic || '',
          keywords: topic.keywords || [topic.title || topic.subtopic || '']
        }));
      }
    }

    payload.subtopics = normalizedSubtopics;

    // console.log('📤 Phase 2 Payload:', { ... });

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 3 minutes timeout for Phase 2
    });

    return {
      success: true,
      phase2Data: response.data, // Return entire array of papers
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 2 webhook error:', error.message);

    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 2 webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 2 webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 2 webhook request failed - no response received');
    }

    throw new Error(`Phase 2 webhook error: ${error.message}`);
  }
};

/**
 * Send to Phase 2 Applications webhook (existing solutions)
 * @param {string} chatId - Unique chat identifier
 * @param {string} refinedProblem - Refined problem statement
 * @returns {Promise<object>} Phase 2 applications response from n8n
 */
export const sendToPhase2ApplicationsWebhook = async (chatId, refinedProblem) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE2_APPLICATIONS_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE2_APPLICATIONS_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refinedProblem: refinedProblem,
      timestamp: new Date().toISOString(),
      phase: 2,
      action: 'process_applications'
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 3 minutes timeout
    });

    return {
      success: true,
      applicationsData: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 2 Applications webhook error:', error.message);

    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 2 Applications webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 2 Applications webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 2 Applications webhook request failed - no response received');
    }

    throw new Error(`Phase 2 Applications webhook error: ${error.message}`);
  }
};

/**
 * Send to Phase 2 GitHub Projects webhook
 * @param {string} chatId - Unique chat identifier
 * @param {string} refinedProblem - Refined problem statement
 * @returns {Promise<object>} Phase 2 GitHub projects response from n8n
 */
export const sendToPhase2GitHubWebhook = async (chatId, refinedProblem) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE2_GITHUB_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE2_GITHUB_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refine_problem_statement: refinedProblem,
      timestamp: new Date().toISOString(),
      phase: 2,
      action: 'process_github'
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 3 minutes timeout
    });

    return {
      success: true,
      githubData: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 2 GitHub webhook error:', error.message);

    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 2 GitHub webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 2 GitHub webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 2 GitHub webhook request failed - no response received');
    }

    throw new Error(`Phase 2 GitHub webhook error: ${error.message}`);
  }
};

/**
 * Send research papers to Phase 3 Research Paper Analysis webhook
 * @param {string} chatId - Unique chat identifier
 * @param {Array} papers - Array of research papers from Phase 2
 * @param {number} chunkNumber - Chunk number for parallel processing
 * @param {number} totalChunks - Total number of chunks being processed
 * @returns {Promise<object>} Phase 3 research paper analysis response from n8n
 */
export const sendToPhase3ResearchPaperWebhook = async (chatId, papers, chunkNumber = 1, totalChunks = 1, refinedProblem = '') => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE3_URL_RESERACH_PAPER;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE3_URL_RESERACH_PAPER is not configured in environment variables');
    }

    // Extract only PDF URLs from papers
    const pdfLinks = papers
      .map(paper => paper.pdfLink || paper.pdf_url)
      .filter(link => link);

    const payload = {
      chatId,
      refined_problem: refinedProblem,
      pdfLinks: pdfLinks,
      chunkNumber: chunkNumber,
      totalChunks: totalChunks,
      timestamp: new Date().toISOString(),
      phase: 3,
      action: 'analyze_research_papers'
    };

    // console.log(`📤 Sending Phase 3 Research Paper Analysis Chunk ${chunkNumber}/${totalChunks} with ${pdfLinks.length} papers`);

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      timeout: 1200000, // 20 minutes timeout for analyzing papers
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
      httpAgent: new http.Agent({ 
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 1200000
      }),
      httpsAgent: new https.Agent({ 
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 1200000,
        rejectUnauthorized: false
      })
    });

    return {
      success: true,
      paperAnalysisData: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 3 Research Paper Analysis webhook error:', error.message);

    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 3 Research Paper Analysis webhook request timed out after 20 minutes');
    }

    if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT') {
      throw new Error(`Connection interrupted (${error.code}) - workflow may still be processing`);
    }

    if (error.response) {
      throw new Error(`Phase 3 Research Paper Analysis webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 3 Research Paper Analysis webhook - no response received');
    }

    throw new Error(`Phase 3 Research Paper Analysis webhook error: ${error.message}`);
  }
};

/**
 * Send GitHub projects to Phase 3 GitHub Project Analysis webhook
 * @param {string} chatId - Unique chat identifier
 * @param {Array} githubProjects - Array of GitHub projects from Phase 2
 * @param {number} chunkNumber - Chunk number for parallel processing
 * @param {number} totalChunks - Total number of chunks being processed
 * @returns {Promise<object>} Phase 3 GitHub project analysis response from n8n
 */
export const sendToPhase3GitHubWebhook = async (chatId, githubProjects, chunkNumber = 1, totalChunks = 1, refinedProblem = '') => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE3_GITHUB_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE3_GITHUB_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refined_problem: refinedProblem,
      data: githubProjects,
      chunkNumber: chunkNumber,
      totalChunks: totalChunks,
      timestamp: new Date().toISOString(),
      phase: 3,
      action: 'analyze_github_projects'
    };

    // console.log(`📤 Sending Phase 3 GitHub Analysis Chunk ${chunkNumber}/${totalChunks} with ${githubProjects.length} projects`);

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      timeout: 1200000, // 20 minutes timeout for analyzing GitHub projects
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
      httpAgent: new http.Agent({ 
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 1200000
      }),
      httpsAgent: new https.Agent({ 
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 1200000,
        rejectUnauthorized: false
      })
    });

    return {
      success: true,
      githubAnalysisData: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 3 GitHub Project Analysis webhook error:', error.message);

    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 3 GitHub Project Analysis webhook request timed out after 20 minutes');
    }

    if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT') {
      throw new Error(`Connection interrupted (${error.code}) - workflow may still be processing`);
    }

    if (error.response) {
      throw new Error(`Phase 3 GitHub Project Analysis webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 3 GitHub Project Analysis webhook - no response received');
    }

    throw new Error(`Phase 3 GitHub Project Analysis webhook error: ${error.message}`);
  }
};

/**
 * Send Phase 2 output (PDF links) to Phase 3 n8n webhook
 * @param {string} chatId - Unique chat identifier
 * @param {Array} pdfLinks - Array of PDF links from Phase 2
 * @returns {Promise<object>} Phase 3 response from n8n
 */
export const sendToPhase3Webhook = async (chatId, pdfLinks) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE3_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE3_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      pdfLinks: pdfLinks,
      timestamp: new Date().toISOString(),
      phase: 3,
      action: 'process_pdfs'
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
      },
      timeout: 1200000, // 20 minutes timeout for Phase 3 (analyzing PDFs is slow)
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      // Add retry logic for connection issues
      validateStatus: function (status) {
        return status >= 200 && status < 500; // Accept any status under 500
      },
      // Keep connection alive
      httpAgent: new http.Agent({ 
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 1200000
      }),
      httpsAgent: new https.Agent({ 
        keepAlive: true,
        keepAliveMsecs: 60000,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 1200000,
        rejectUnauthorized: false // In case of self-signed certs
      })
    });

    return {
      success: true,
      phase3Data: response.data, // Return entire array of analyzed papers
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 3 webhook error:', error.message);
    // console.error('Error details:', { ... });

    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 3 webhook request timed out after 20 minutes. The n8n workflow may still be processing.');
    }

    if (error.code === 'ECONNRESET' || error.code === 'EPIPE' || error.code === 'ERR_SOCKET_CONNECTION_TIMEOUT') {
      throw new Error(`Connection to n8n was interrupted (${error.code}). This usually means:\n1. n8n workflow is still processing but took too long\n2. Network/proxy timeout\n3. n8n server restarted\n\nTry reducing the number of PDFs or check n8n logs.`);
    }

    if (error.response) {
      throw new Error(`Phase 3 webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 3 webhook - no response from n8n. Check: 1) n8n is running, 2) webhook URL is correct, 3) n8n workflow logs');
    }

    throw new Error(`Phase 3 webhook error: ${error.message}`);
  }
};

/**
 * Send Phase 3 output (chatId and refined problem) to Phase 4 n8n webhook
 * @param {string} chatId - Unique chat identifier
 * @param {string} refinedProblem - Refined problem statement from Phase 1
 * @returns {Promise<object>} Phase 4 response from n8n
 */
/**
 * Send chatId and refined problem to Phase 4 Research Paper webhook
 */
export const sendToPhase4ResearchPaperWebhook = async (chatId, refinedProblem) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE4_RESEARCH_PAPER_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE4_RESEARCH_PAPER_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refinedProblem: refinedProblem,
      timestamp: new Date().toISOString(),
      phase: 4,
      subPhase: 'researchPaperAnalysis',
      action: 'process_phase4_research_paper'
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes timeout
    });

    return {
      success: true,
      phase4Data: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 4 Research Paper webhook error:', error.message);

    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 4 Research Paper webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 4 Research Paper webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 4 Research Paper webhook request failed - no response received');
    }

    throw new Error(`Phase 4 Research Paper webhook error: ${error.message}`);
  }
};

/**
 * Send chatId and refined problem to Phase 4 GitHub Projects webhook
 */
export const sendToPhase4GitHubWebhook = async (chatId, refinedProblem) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE4_GITHUB_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE4_GITHUB_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refinedProblem: refinedProblem,
      timestamp: new Date().toISOString(),
      phase: 4,
      subPhase: 'githubAnalysis',
      action: 'process_phase4_github'
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes timeout
    });

    return {
      success: true,
      phase4Data: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 4 GitHub webhook error:', error.message);

    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 4 GitHub webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 4 GitHub webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 4 GitHub webhook request failed - no response received');
    }

    throw new Error(`Phase 4 GitHub webhook error: ${error.message}`);
  }
};

/**
 * Send chatId and refined problem to Phase 4 Application webhook
 */
export const sendToPhase4ApplicationWebhook = async (chatId, refinedProblem) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE4_APPLICATION_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE4_APPLICATION_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refinedProblem: refinedProblem,
      timestamp: new Date().toISOString(),
      phase: 4,
      subPhase: 'applicationAnalysis',
      action: 'process_phase4_application'
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes timeout
    });

    return {
      success: true,
      phase4Data: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 4 Application webhook error:', error.message);

    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 4 Application webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 4 Application webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 4 Application webhook request failed - no response received');
    }

    throw new Error(`Phase 4 Application webhook error: ${error.message}`);
  }
};

/**
 * @deprecated Use sendToPhase4ResearchPaperWebhook, sendToPhase4GitHubWebhook, sendToPhase4ApplicationWebhook instead
 * Legacy function kept for backward compatibility
 */
export const sendToPhase4Webhook = async (chatId, refinedProblem) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE4_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE4_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refinedProblem: refinedProblem,
      timestamp: new Date().toISOString(),
      phase: 4,
      action: 'process_phase4'
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes timeout for Phase 4
    });

    return {
      success: true,
      phase4Data: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 4 webhook error:', error.message);

    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 4 webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 4 webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 4 webhook request failed - no response received');
    }

    throw new Error(`Phase 4 webhook error: ${error.message}`);
  }
};

/**
 * Send Phase 4 output (chatId and refined problem) to Phase 5 n8n webhook
 * @param {string} chatId - Unique chat identifier
 * @param {string} refinedProblem - Refined problem statement from Phase 1
 * @returns {Promise<object>} Phase 5 response from n8n
 */
export const sendToPhase5Webhook = async (chatId, refinedProblem) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE5_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE5_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refinedProblem: refinedProblem,
      timestamp: new Date().toISOString(),
      phase: 5,
      action: 'process_phase5'
    };

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes timeout for Phase 5
    });

    return {
      success: true,
      phase5Data: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 5 webhook error:', error.message);

    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 5 webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 5 webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 5 webhook request failed - no response received');
    }

    throw new Error(`Phase 5 webhook error: ${error.message}`);
  }
};

/**
 * Send data to Phase 4 n8n webhook for gap analysis
 * @param {string} chatId - Unique chat session identifier
 * @param {string} refinedProblem - Refined problem statement
 * @returns {Promise<Object>} Phase 4 webhook response
 */
export const sendToPhase4GapFinderWebhook = async (chatId, refinedProblem) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE4_GAP_FINDER_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE4_GAP_FINDER_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refinedProblem: refinedProblem,
      timestamp: new Date().toISOString(),
      phase: 4,
      action: 'gap_finder'
    };

    // console.log('📤 Sending Phase 4 Gap Finder request:', { chatId });

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 3 minutes timeout for Phase 4
    });

    // console.log('📥 Phase 4 Gap Finder response received');

    return {
      success: true,
      phase4Data: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 4 Gap Finder webhook error:', error.message);

    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 4 Gap Finder webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 4 Gap Finder webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 4 Gap Finder webhook request failed - no response received');
    }

    throw new Error(`Phase 4 Gap Finder webhook error: ${error.message}`);
  }
};

/**
 * Send data to Phase 5 n8n webhook for literature review
 * @param {string} chatId - Unique chat session identifier
 * @param {string} refinedProblem - Refined problem statement
 * @returns {Promise<Object>} Phase 5 webhook response
 */
export const sendToPhase5LiteratureReviewWebhook = async (chatId, refinedProblem) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE5_LITERATURE_REVIEW_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE5_LITERATURE_REVIEW_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refinedProblem: refinedProblem,
      timestamp: new Date().toISOString(),
      phase: 5,
      action: 'literature_review'
    };

    // console.log('📤 Sending Phase 5 Literature Review request:', { chatId });

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 3 minutes timeout for Phase 5
    });

    // console.log('📥 Phase 5 Literature Review response received');

    return {
      success: true,
      phase5Data: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 5 Literature Review webhook error:', error.message);

    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 5 Literature Review webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 5 Literature Review webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 5 Literature Review webhook request failed - no response received');
    }

    throw new Error(`Phase 5 Literature Review webhook error: ${error.message}`);
  }
};

/**
 * Send data to Phase 6 n8n webhook for best solution generation
 * @param {string} chatId - Unique chat session identifier
 * @param {string} refinedProblem - Refined problem statement
 * @returns {Promise<Object>} Phase 6 webhook response
 */
export const sendToPhase6Webhook = async (chatId, refinedProblem, expectedOutcome = '') => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE6_URL;

    if (!webhookUrl) {
      throw new Error('N8N_WEBHOOK_PHASE6_URL is not configured in environment variables');
    }

    const payload = {
      chatId,
      refinedProblem: refinedProblem,
      expectedOutcome: expectedOutcome,
      timestamp: new Date().toISOString(),
      phase: 6,
      action: 'process_phase6'
    };

    // console.log('📤 Sending Phase 6 webhook with expected outcome:', expectedOutcome ? `"${expectedOutcome.substring(0, 100)}${expectedOutcome.length > 100 ? '...' : ''}"` : 'None');

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes timeout for Phase 6
    });

    return {
      success: true,
      phase6Data: response.data,
      rawResponse: response.data,
      statusCode: response.status
    };

  } catch (error) {
    // console.error('❌ Phase 6 webhook error:', error.message);

    // Handle different error types
    if (error.code === 'ECONNABORTED') {
      throw new Error('Phase 6 webhook request timed out');
    }

    if (error.response) {
      throw new Error(`Phase 6 webhook failed with status ${error.response.status}: ${error.response.statusText}`);
    }

    if (error.request) {
      throw new Error('Phase 6 webhook request failed - no response received');
    }

    throw new Error(`Phase 6 webhook error: ${error.message}`);
  }
};

/**
 * Test n8n webhook connectivity
 * @returns {Promise<boolean>} True if webhook is accessible
 */
export const testN8nWebhook = async () => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_PHASE1_URL;

    if (!webhookUrl) {
      return false;
    }

    const response = await axios.post(webhookUrl, {
      test: true,
      timestamp: new Date().toISOString()
    }, {
      timeout: 5000
    });

    return response.status === 200;
  } catch (error) {
    // console.error('n8n webhook test failed:', error.message);
    return false;
  }
};
