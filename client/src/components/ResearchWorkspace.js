import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSessionStatus, getSessionDetails, retryPhase, stopPhase, submitExpectedOutcome, updateExpectedOutcome } from '../services/api';
import PhaseContent from './PhaseContent';
import Modal from './Modal';
import './ResearchWorkspace.css';

const ResearchWorkspace = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState(1);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [retryingPhase, setRetryingPhase] = useState(null);
  const [stoppingPhase, setStoppingPhase] = useState(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [resumePhase, setResumePhase] = useState(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, phaseNumber: null });
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [submittingOutcome, setSubmittingOutcome] = useState(false);
  const [pendingRetry, setPendingRetry] = useState(null); // Stores {phaseNumber, shouldDelete} for Phase 6 retry

  useEffect(() => {
    if (!chatId) {
      navigate('/');
      return;
    }

    fetchSessionData();
    const interval = setInterval(fetchSessionData, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Check for incomplete phases and show resume modal (only once per session)
  useEffect(() => {
    if (sessionData && sessionData.details && sessionData.details.phases && !loading) {
      const modalShownKey = `resume_modal_shown_${chatId}`;
      const alreadyShown = sessionStorage.getItem(modalShownKey);
      
      if (!alreadyShown) {
        const failedPhase = findFirstFailedPhase();
        if (failedPhase) {
          setResumePhase(failedPhase);
          setShowResumeModal(true);
          sessionStorage.setItem(modalShownKey, 'true');
        }
      } else {
        // If modal was already shown but all phases are now working, clear the flag
        const failedPhase = findFirstFailedPhase();
        if (!failedPhase) {
          sessionStorage.removeItem(modalShownKey);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData, loading]);

  // Check if Phase 5 is completed and Phase 6 not started - show expected outcome modal
  useEffect(() => {
    if (sessionData && sessionData.details && sessionData.details.phases && !loading && !pendingRetry) {
      const phase5Status = sessionData.details.phases.phase5?.status;
      const phase6Status = sessionData.details.phases.phase6?.status;
      const hasExpectedOutcome = sessionData.details.expectedOutcome;

      // Show modal only if Phase 5 is completed, Phase 6 is pending, and no expected outcome has been submitted
      // Also don't show if we're in the middle of a retry flow
      if (phase5Status === 'completed' && phase6Status === 'pending' && !hasExpectedOutcome) {
        setShowOutcomeModal(true);
      } else if (hasExpectedOutcome && phase6Status !== 'pending') {
        setShowOutcomeModal(false);
      }
    }
  }, [sessionData, loading, pendingRetry]);

  const fetchSessionData = async () => {
    try {
      const [statusRes, detailsRes] = await Promise.all([
        getSessionStatus(chatId),
        getSessionDetails(chatId)
      ]);

      if (statusRes.success && detailsRes.success) {
        setSessionData({
          status: statusRes.data,
          details: detailsRes.data
        });
        setError(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const findFirstFailedPhase = () => {
    if (!sessionData?.details?.phases) {
      return null;
    }
    
    const phases = sessionData.details.phases;
    
    // Map frontend phase numbers to backend phase keys
    // Frontend: 1,2,3,4,5,6,7 → Backend: phase1,phase2,phase3,phase4,phase5,phase6,Chat
    // NOTE: Phase 7 is Chat and doesn't have traditional completion status - exclude it
    const phaseMapping = [
      { frontend: 1, backend: 'phase1' },
      { frontend: 2, backend: 'phase2' },
      { frontend: 3, backend: 'phase3' },
      { frontend: 4, backend: 'phase4' },  // Gap Finder
      { frontend: 5, backend: 'phase5' },  // Literature Review
      { frontend: 6, backend: 'phase6' }   // Best Solution
      // Phase 7 (Chat) is excluded as it's always available
    ];
    
    for (let i = 0; i < phaseMapping.length; i++) {
      const { frontend, backend } = phaseMapping[i];
      const phaseData = phases[backend];
      const phaseStatus = phaseData?.status;
      const startedAt = phaseData?.startedAt;
      
      // If phase explicitly failed
      if (phaseStatus === 'failed') {
        return frontend;
      }
      
      // If phase is stuck in "processing" for too long (more than 20 minutes)
      if (phaseStatus === 'processing' && startedAt) {
        const startTime = new Date(startedAt).getTime();
        const currentTime = new Date().getTime();
        const minutesElapsed = (currentTime - startTime) / (1000 * 60);
        
        // Phase stuck for more than 20 minutes
        if (minutesElapsed > 20) {
          return frontend;
        }
      }
      
      // If previous phase completed but current phase was started and is now stuck in pending
      // (Only if it was started before - has startedAt timestamp)
      if (i > 0) {
        const prevBackend = phaseMapping[i - 1].backend;
        const prevPhaseStatus = phases[prevBackend]?.status;
        if (prevPhaseStatus === 'completed' && phaseStatus === 'pending' && startedAt) {
          // Phase was started but is now back to pending (likely stopped/failed)
          return frontend;
        }
      }
    }
    
    return null;
  };

  const handleResumeFromPhase = async () => {
    if (!resumePhase) return;
    
    setShowResumeModal(false);
    setRetryingPhase(resumePhase);
    setSelectedPhase(resumePhase);

    // Frontend phase number equals backend phase number now (no conversion needed)
    const backendPhaseNumber = resumePhase;

    // First, mark stale processing phase as failed in backend
    const phaseData = sessionData?.details?.phases?.[`phase${backendPhaseNumber}`];
    if (phaseData?.status === 'processing') {
      // The retry will handle marking it properly
    }

    try {
      await retryPhase(chatId, backendPhaseNumber, false); // Don't delete existing data
      fetchSessionData();
    } catch (err) {
      setError(`Failed to resume Phase ${resumePhase}: ${err.message}`);
    } finally {
      setRetryingPhase(null);
    }
  };

  const handleDismissModal = () => {
    setShowResumeModal(false);
    setResumePhase(null);
  };

  // Expose function to manually check for failed phases (for testing)
  window.checkFailedPhases = () => {
    const modalShownKey = `resume_modal_shown_${chatId}`;
    sessionStorage.removeItem(modalShownKey);
    const failedPhase = findFirstFailedPhase();
    if (failedPhase) {
      setResumePhase(failedPhase);
      setShowResumeModal(true);
      sessionStorage.setItem(modalShownKey, 'true');
    }
    return failedPhase;
  };

  if (loading) {
    return (
      <div className="workspace-loading">
        <div className="loading-spinner"></div>
        <p>Loading research session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workspace-error">
        <h2>❌ Error</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')}>Return Home</button>
      </div>
    );
  }

  if (!sessionData) {
    return null;
  }

  const { status, details } = sessionData;

  const getPhaseStatus = (phaseNum) => {
    // Map frontend phase numbers to backend phase keys
    // Frontend: 1,2,3,4,5,6,7 → Backend: phase1,phase2,phase3,phase4,phase5,phase6,chat
    let backendPhaseKey;
    if (phaseNum === 7) {
      backendPhaseKey = 'phase7'; // Frontend Phase 7 → Chat phase
    } else {
      backendPhaseKey = `phase${phaseNum}`;
    }
    
    return details?.phases?.[backendPhaseKey]?.status || 'pending';
  };

  const canOpenPhase = (phaseNum) => {
    // Phase 7 (Chat) is always clickable
    if (phaseNum === 7) {
      return true;
    }
    
    const phaseStatus = getPhaseStatus(phaseNum);
    return phaseStatus === 'completed' || phaseStatus === 'processing';
  };

  const handlePhaseClick = (phaseNum) => {
    // Phase 6 (Chat) should always open directly without any modal
    if (phaseNum === 6) {
      setSelectedPhase(phaseNum);
      setSidebarOpen(false);
      return;
    }

    const phaseStatus = getPhaseStatus(phaseNum);
    const isAnyPhaseProcessing = [1, 2, 3, 4, 5, 6].some(i => getPhaseStatus(i) === 'processing');
    
    // If phase is failed and no phases are currently processing, offer to restart
    if (phaseStatus === 'failed' && !isAnyPhaseProcessing) {
      setResumePhase(phaseNum);
      setShowResumeModal(true);
      return;
    }
    
    // If phase is pending/failed but previous phase is completed, offer to start it
    if ((phaseStatus === 'pending' || phaseStatus === 'failed') && phaseNum > 1 && !isAnyPhaseProcessing) {
      const prevPhaseStatus = getPhaseStatus(phaseNum - 1);
      if (prevPhaseStatus === 'completed') {
        setResumePhase(phaseNum);
        setShowResumeModal(true);
        return;
      }
    }
    
    if (canOpenPhase(phaseNum)) {
      setSelectedPhase(phaseNum);
      setSidebarOpen(false); // Close sidebar on mobile after selection
    }
  };

  const handleRetryPhase = async (phaseNumber) => {
    // For Phase 6, show expected outcome modal first
    if (phaseNumber === 6) {
      setConfirmModal({
        isOpen: true,
        title: 'Delete Existing Data?',
        message: `Do you want to DELETE existing data for Phase ${phaseNumber}?\n\n• Click "Delete & Restart" to DELETE existing data and start fresh\n• Click "Keep & Merge" to KEEP existing data and merge with new results`,
        onConfirm: (shouldDelete) => {
          // Store the retry action and show outcome modal
          setPendingRetry({ phaseNumber: 6, shouldDelete });
          setExpectedOutcome(''); // Clear previous outcome
          setShowOutcomeModal(true);
        },
        phaseNumber
      });
    } else {
      setConfirmModal({
        isOpen: true,
        title: 'Delete Existing Data?',
        message: `Do you want to DELETE existing data for Phase ${phaseNumber}?\n\n• Click "Delete & Restart" to DELETE existing data and start fresh\n• Click "Keep & Merge" to KEEP existing data and merge with new results`,
        onConfirm: (shouldDelete) => executeRetryPhase(phaseNumber, shouldDelete),
        phaseNumber
      });
    }
  };

  const executeRetryPhase = async (phaseNumber, shouldDelete) => {
    setRetryingPhase(phaseNumber);

    // Frontend phase number equals backend phase number now (no conversion needed)
    const backendPhaseNumber = phaseNumber;

    try {
      await retryPhase(chatId, backendPhaseNumber, shouldDelete);
      setAlertModal({
        isOpen: true,
        title: 'Retry Initiated',
        message: `Phase ${phaseNumber} retry initiated! The page will update automatically.`,
        type: 'success'
      });
      fetchSessionData(); // Refresh data
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Retry Failed',
        message: `Failed to retry Phase ${phaseNumber}: ${err.message}`,
        type: 'error'
      });
    } finally {
      setRetryingPhase(null);
    }
  };

  const handleStopPhase = async (phaseNumber) => {
    setStoppingPhase(phaseNumber);
    
    try {
      // console.log('Attempting to stop phase:', phaseNumber);
      await stopPhase(chatId, phaseNumber);
      setAlertModal({
        isOpen: true,
        title: 'Phase Stopped',
        message: `Phase ${phaseNumber} has been stopped successfully.`,
        type: 'success'
      });
      fetchSessionData(); // Refresh data
    } catch (err) {
      // console.error('Stop phase error:', err);
      setAlertModal({
        isOpen: true,
        title: 'Stop Failed',
        message: err.message || `Failed to stop Phase ${phaseNumber}`,
        type: 'error'
      });
    } finally {
      setStoppingPhase(null);
    }
  };

  const handleSubmitOutcome = async () => {
    const trimmedOutcome = expectedOutcome.trim();
    
    if (!trimmedOutcome || trimmedOutcome.length === 0) {
      setAlertModal({
        isOpen: true,
        title: 'Input Required',
        message: 'Please enter your expected outcome or type "NA" or "No" if you have no specific expectations.',
        type: 'error'
      });
      return;
    }

    // Count words
    const wordCount = trimmedOutcome.split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount > 200) {
      setAlertModal({
        isOpen: true,
        title: 'Word Limit Exceeded',
        message: `Your input contains ${wordCount} words. Please limit it to 200 words or less.`,
        type: 'error'
      });
      return;
    }

    setSubmittingOutcome(true);
    
    try {
      // Check if this is for a retry or normal Phase 6 trigger
      if (pendingRetry) {
        // For retry: Update outcome without triggering Phase 6, then call retry
        await updateExpectedOutcome(chatId, trimmedOutcome);
        // Then execute the retry which will use the updated outcome
        await retryPhase(chatId, pendingRetry.phaseNumber, pendingRetry.shouldDelete);
        setShowOutcomeModal(false);
        setExpectedOutcome('');
        setPendingRetry(null);
        setAlertModal({
          isOpen: true,
          title: 'Retry Initiated',
          message: 'Phase 6 retry initiated with your new expected outcome! The page will update automatically.',
          type: 'success'
        });
      } else {
        // Normal Phase 6 trigger after Phase 5 (this will auto-trigger Phase 6)
        await submitExpectedOutcome(chatId, trimmedOutcome);
        setShowOutcomeModal(false);
        setExpectedOutcome('');
        setAlertModal({
          isOpen: true,
          title: 'Success',
          message: 'Thank you! Phase 6 will now generate the best solution based on your expectations.',
          type: 'success'
        });
      }
      fetchSessionData(); // Refresh to show Phase 6 starting
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Submission Failed',
        message: err.message || 'Failed to submit expected outcome. Please try again.',
        type: 'error'
      });
    } finally {
      setSubmittingOutcome(false);
    }
  };

  const phases = [
    { number: 1, title: 'Prompt Enhancement', icon: '✨', estimatedTime: '2-3 min' },
    { number: 2, title: 'Research Discovery', icon: '🔍', estimatedTime: '2-3 min' },
    { number: 3, title: 'Analysis & Synthesis', icon: '📊', estimatedTime: '2-3 min' },
    { number: 4, title: 'Gap Finder', icon: '🔎', estimatedTime: '2-3 min' },
    { number: 5, title: 'Literature Review', icon: '📚', estimatedTime: '2-3 min' },
    { number: 6, title: 'Best Solution', icon: '🏆', estimatedTime: '4-5 min' },
    { number: 7, title: 'Research Chat', icon: '💬', estimatedTime: 'Always Available' }
  ];

  return (
    <div className="research-workspace">
      {/* Resume Modal */}
      {showResumeModal && resumePhase && (
        <div className="modal-overlay">
          <div className="modal-card resume-modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {sessionData?.details?.phases?.[`phase${resumePhase}`]?.status === 'processing' 
                  ? '⚠️ Stale Process Detected' 
                  : '⚠️ Incomplete Phase Detected'}
              </h2>
            </div>
            <div className="modal-body">
              <p className="resume-message">
                Phase {resumePhase} ({phases[resumePhase - 1]?.title}) 
                {sessionData?.details?.phases?.[`phase${resumePhase}`]?.status === 'processing' 
                  ? ' was interrupted and is stuck in processing state.'
                  : ' did not complete successfully.'}
              </p>
              <p className="resume-question">
                Would you like to resume from Phase {resumePhase} and continue the research process?
              </p>
              <div className="resume-info">
                <p><strong>What will happen:</strong></p>
                <ul>
                  {sessionData?.details?.phases?.[`phase${resumePhase}`]?.status === 'processing' && (
                    <li>The stale process will be terminated</li>
                  )}
                  <li>Phase {resumePhase} will restart automatically</li>
                  <li>Existing data will be preserved</li>
                  <li>Subsequent phases will be triggered automatically</li>
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="form-button form-button-secondary"
                onClick={handleDismissModal}
              >
                Dismiss
              </button>
              <button 
                className="form-button form-button-primary"
                onClick={handleResumeFromPhase}
              >
                {sessionData?.details?.phases?.[`phase${resumePhase}`]?.status === 'processing'
                  ? 'Terminate & Restart'
                  : 'Resume from Phase ' + resumePhase}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expected Outcome Modal - Mandatory after Phase 5 */}
      {showOutcomeModal && (
        <div className="modal-overlay" style={{ pointerEvents: 'all' }}>
          <div className="modal-card resume-modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header" style={{ backgroundColor: '#667eea' }}>
              <h2 className="modal-title" style={{ color: 'white' }}>
                📝 Expected Outcome Required
              </h2>
            </div>
            <div className="modal-body">
              <p className="resume-message" style={{ marginBottom: '20px' }}>
                {pendingRetry 
                  ? 'Before retrying Phase 6, please provide your expected outcome for the solution. This will help generate a better result tailored to your needs.'
                  : 'Phase 5 (Literature Review) has been completed successfully! Before generating the best solution in Phase 6, please tell us what kind of outcome you\'re expecting from this research.'}
              </p>
              <p style={{ marginBottom: '15px', fontWeight: '600', color: '#2d3748' }}>
                What kind of solution or outcome are you looking for? <span style={{ color: '#e53e3e' }}>*</span>
              </p>
              <textarea
                value={expectedOutcome}
                onChange={(e) => setExpectedOutcome(e.target.value)}
                placeholder="Describe your expected outcome or solution approach here... (If no specific expectation, type 'NA' or 'No')"
                style={{
                  width: '100%',
                  minHeight: '150px',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  marginBottom: '10px'
                }}
                maxLength={2000}
              />
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                fontSize: '13px',
                color: '#718096'
              }}>
                <span>
                  {expectedOutcome.trim().split(/\s+/).filter(w => w.length > 0).length} / 200 words
                </span>
                <span style={{ fontStyle: 'italic' }}>
                  * Maximum 200 words
                </span>
              </div>
              <div style={{
                marginTop: '15px',
                padding: '12px',
                backgroundColor: '#edf2f7',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#4a5568'
              }}>
                <strong>Note:</strong> If you don't have any specific expectations or outcome in mind, 
                simply type <strong>"NA"</strong> or <strong>"No"</strong> to continue.
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="form-button form-button-primary"
                onClick={handleSubmitOutcome}
                disabled={submittingOutcome}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                {submittingOutcome ? '⏳ Submitting...' : '✅ Submit & Start Phase 6'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Toggle Button */}
      <button 
        className="sidebar-toggle-btn" 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle Sidebar"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Left Sidebar - Phase Navigation */}
      <div className={`workspace-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="home-button" onClick={() => navigate('/')}>
            ← Home
          </button>
        </div>
        <div className="sidebar-title-section">
          <h2>Research Phases</h2>
          <div className="progress-circle">
            <svg viewBox="0 0 36 36" className="circular-chart">
              <path
                className="circle-bg"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="circle"
                strokeDasharray={`${status.progress}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <text x="18" y="20.35" className="percentage">{status.progress}%</text>
            </svg>
          </div>
        </div>

        <div className="phases-list">
          {phases.map((phase) => {
            const phaseStatus = getPhaseStatus(phase.number);
            const isClickable = canOpenPhase(phase.number);
            const isActive = selectedPhase === phase.number;
            
            // Make failed phases clickable if no other phase is processing
            const isAnyPhaseProcessing = [1, 2, 3, 4, 5, 6].some(i => getPhaseStatus(i) === 'processing');
            const isFailedAndClickable = phaseStatus === 'failed' && !isAnyPhaseProcessing;
            const canRetryPhase = isFailedAndClickable || (phase.number > 1 && getPhaseStatus(phase.number - 1) === 'completed' && phaseStatus === 'pending' && !isAnyPhaseProcessing);

            return (
              <div
                key={phase.number}
                className={`phase-item ${phaseStatus} ${isActive ? 'active' : ''} ${!isClickable && !canRetryPhase ? 'locked' : ''}`}
                onClick={() => handlePhaseClick(phase.number)}
                style={{ cursor: (isClickable || canRetryPhase) ? 'pointer' : 'not-allowed' }}
              >
                <div className="phase-item-icon">{phase.icon}</div>
                <div className="phase-item-content">
                  <div className="phase-item-header">
                    <span className="phase-item-number">Phase {phase.number}</span>
                    <span className={`phase-status-badge ${phaseStatus}`}>
                      {phaseStatus === 'completed' && '✓'}
                      {phaseStatus === 'processing' && '⟳'}
                      {phaseStatus === 'failed' && '✗'}
                      {phaseStatus === 'pending' && '🔒'}
                    </span>
                  </div>
                  <h4>{phase.title}</h4>
                  {phaseStatus === 'processing' && (
                    <p className="phase-time-estimate">⏱️ {phase.estimatedTime}</p>
                  )}
                  {isFailedAndClickable && (
                    <p className="phase-retry-hint" style={{ fontSize: '0.75rem', color: '#e53e3e', marginTop: '0.25rem' }}>
                      Click to retry
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content Area */}
      <div className="workspace-main">
        <div className="workspace-header">
          <div className="session-info">
            <h1>{phases[selectedPhase - 1].title}</h1>
            <div className="session-meta">
              <span className="meta-item">
                <strong>Session ID:</strong> {chatId.slice(0, 8)}...
              </span>
              <span className="meta-item">
                <strong>Status:</strong> <span className={`status-badge ${status.overallStatus}`}>
                  {status.overallStatus}
                </span>
              </span>
              <span className="meta-item">
                <strong>Total Time:</strong> 15-20 min (Phases 1-6)
              </span>
              {selectedPhase <= 6 && (
                <span className="meta-item">
                  <strong>Current Phase Time:</strong> {phases[selectedPhase - 1].estimatedTime}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="workspace-content">
          <PhaseContent
            phaseNumber={selectedPhase}
            sessionData={sessionData}
            chatId={chatId}
            onRetry={handleRetryPhase}
            isRetrying={retryingPhase === selectedPhase}
            onStop={handleStopPhase}
            isStopping={stoppingPhase === selectedPhase}
          />
        </div>
      </div>

      {/* Alert Modal */}
      <Modal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        confirmText="OK"
      />

      {/* Confirm Modal for Delete/Keep */}
      {confirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header modal-confirm">
              <span className="modal-icon">?</span>
              <h3 className="modal-title">{confirmModal.title}</h3>
            </div>
            
            <div className="modal-body">
              <p className="modal-message">{confirmModal.message}</p>
            </div>
            
            <div className="modal-footer">
              <button 
                className="modal-button modal-button-cancel"
                onClick={() => {
                  confirmModal.onConfirm(false);
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
              >
                Keep & Merge
              </button>
              <button 
                className="modal-button modal-button-confirm modal-button-error"
                onClick={() => {
                  confirmModal.onConfirm(true);
                  setConfirmModal({ ...confirmModal, isOpen: false });
                }}
              >
                Delete & Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResearchWorkspace;
