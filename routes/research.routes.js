import express from 'express';
import {
  initiateResearch,
  getSessionStatus,
  getSessionDetails,
  getAllSessions,
  retryPhase,
  stopPhase,
  submitExpectedOutcome,
  updateExpectedOutcome,
  deleteSession
} from '../controllers/research.controller.js';

const router = express.Router();

// POST /api/research/initiate - Start Phase 1 (Prompt Enhancement)
router.post('/initiate', initiateResearch);

// GET /api/research/status/:chatId - Get current status of a research session
router.get('/status/:chatId', getSessionStatus);

// GET /api/research/session/:chatId - Get full details of a research session
router.get('/session/:chatId', getSessionDetails);

// GET /api/research/sessions - Get all research sessions (with pagination)
router.get('/sessions', getAllSessions);

// POST /api/research/:chatId/retry-phase - Retry a specific phase
router.post('/:chatId/retry-phase', retryPhase);

// POST /api/research/:chatId/stop-phase - Stop/terminate a phase
router.post('/:chatId/stop-phase', stopPhase);

// POST /api/research/:chatId/submit-outcome - Submit expected outcome and trigger Phase 6
router.post('/:chatId/submit-outcome', submitExpectedOutcome);

// POST /api/research/:chatId/update-outcome - Update expected outcome without triggering Phase 6 (for retries)
router.post('/:chatId/update-outcome', updateExpectedOutcome);

// DELETE /api/research/:chatId - Delete a research session
router.delete('/:chatId', deleteSession);

export default router;
