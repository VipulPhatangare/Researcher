const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:5000/api';

/**
 * Get request headers
 */
const getAuthHeaders = () => {
  return {
    'Content-Type': 'application/json'
  };
};

/**
 * Initiate a new research session
 */
export const initiateResearch = async (problemStatement, metadata = {}) => {
  const userEmail = localStorage.getItem('userEmail');
  const response = await fetch(`${API_BASE_URL}/research/initiate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ problemStatement, metadata, userEmail }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to initiate research');
  }

  return response.json();
};

/**
 * Get session status
 */
export const getSessionStatus = async (chatId) => {
  const response = await fetch(`${API_BASE_URL}/research/status/${chatId}`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch session status');
  }

  return response.json();
};

/**
 * Get full session details
 */
export const getSessionDetails = async (chatId) => {
  const response = await fetch(`${API_BASE_URL}/research/session/${chatId}`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch session details');
  }

  return response.json();
};

/**
 * Get all sessions with pagination
 */
export const getAllSessions = async (page = 1, limit = 10) => {
  const userEmail = localStorage.getItem('userEmail');
  const emailParam = userEmail ? `&userEmail=${encodeURIComponent(userEmail)}` : '';
  const response = await fetch(`${API_BASE_URL}/research/sessions?page=${page}&limit=${limit}${emailParam}`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch sessions');
  }

  return response.json();
};

/**
 * Retry a specific phase
 */
export const retryPhase = async (chatId, phase, deleteExisting = false) => {
  const response = await fetch(`${API_BASE_URL}/research/${chatId}/retry-phase`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ phase, deleteExisting }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to retry phase');
  }

  return response.json();
};

/**
 * Stop/terminate a phase
 */
export const stopPhase = async (chatId, phase) => {
  const response = await fetch(`${API_BASE_URL}/research/${chatId}/stop-phase`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ phase }),
  });

  if (!response.ok) {
    const error = await response.json();
    // console.error('Stop phase API error:', error);
    throw new Error(error.error || 'Failed to stop phase');
  }

  return response.json();
};

/**
 * Submit expected outcome after Phase 5
 */
export const submitExpectedOutcome = async (chatId, expectedOutcome) => {
  const response = await fetch(`${API_BASE_URL}/research/${chatId}/submit-outcome`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ expectedOutcome }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit expected outcome');
  }

  return response.json();
};

/**
 * Update expected outcome without triggering Phase 6 (for retries)
 */
export const updateExpectedOutcome = async (chatId, expectedOutcome) => {
  const response = await fetch(`${API_BASE_URL}/research/${chatId}/update-outcome`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ expectedOutcome }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update expected outcome');
  }

  return response.json();
};

/**
 * Delete a research session
 */
export const deleteSession = async (chatId) => {
  const response = await fetch(`${API_BASE_URL}/research/${chatId}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete session');
  }

  return response.json();
};

/**
 * Health check
 */
export const healthCheck = async () => {
  const response = await fetch(`${API_BASE_URL.replace('/api', '')}/api/health`);
  return response.json();
};
