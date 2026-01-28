import React from 'react';
import { cleanAbstract } from '../utils/textCleaner';
import './PhaseContent.css';
import ChatPhase from './ChatPhase';

const PhaseContent = ({ phaseNumber, sessionData, chatId, onRetry, isRetrying, onStop, isStopping }) => {
  const { details } = sessionData;
  
  // Map frontend phase numbers to backend phase numbers
  // Frontend: 1,2,3,4,5,6,7 → Backend: 1,2,3,4,5,6,Chat
  let backendPhaseNumber = phaseNumber;
  if (phaseNumber === 7) {
    // Phase 7 is Chat - handled separately
    backendPhaseNumber = null;
  }
  
  const phaseKey = backendPhaseNumber ? `phase${backendPhaseNumber}` : null;
  const phaseData = phaseKey ? details?.phases?.[phaseKey] : null;
  const phaseStatus = phaseData?.status || 'pending';

  // Phase-specific rendering
  const renderPhaseContent = () => {
    switch (phaseNumber) {
      case 1:
        return <Phase1Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={backendPhaseNumber} onRetry={onRetry} isRetrying={isRetrying} onStop={onStop} isStopping={isStopping} chatId={chatId} />;
      case 2:
        return <Phase2Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={backendPhaseNumber} onRetry={onRetry} isRetrying={isRetrying} onStop={onStop} isStopping={isStopping} chatId={chatId} />;
      case 3:
        return <Phase3Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={backendPhaseNumber} onRetry={onRetry} isRetrying={isRetrying} onStop={onStop} isStopping={isStopping} chatId={chatId} />;
      case 4:
        // Frontend Phase 4 = Backend Phase 4 (Gap Finder)
        return <Phase4Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={backendPhaseNumber} onRetry={onRetry} isRetrying={isRetrying} onStop={onStop} isStopping={isStopping} chatId={chatId} />;
      case 5:
        // Frontend Phase 5 = Backend Phase 5 (Literature Review)
        return <Phase5Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={backendPhaseNumber} onRetry={onRetry} isRetrying={isRetrying} onStop={onStop} isStopping={isStopping} chatId={chatId} />;
      case 6:
        // Frontend Phase 6 = Backend Phase 6 (Best Solution)
        return <Phase6Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={backendPhaseNumber} onRetry={onRetry} isRetrying={isRetrying} onStop={onStop} isStopping={isStopping} chatId={chatId} />;
      case 7:
        // Frontend Phase 7 = Chat
        return <ChatPhase chatId={chatId} />;
      default:
        return <div>Phase not found</div>;
    }
  };

  return (
    <div className="phase-content-container">
      {renderPhaseContent()}
    </div>
  );
};

// Download Report Button Component
const DownloadReportButton = ({ chatId }) => {
  const handleDownload = async () => {
    const API_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';
    try {
      const response = await fetch(`${API_URL}/api/report/${chatId}/download`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/pdf',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Research_Report_${chatId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // console.error('Download error:', error);
      alert('Failed to download report. Please try again.');
    }
  };

  return (
    <button className="download-report-button" onClick={handleDownload}>
      <span className="download-icon">📥</span>
      Download Research Report (PDF)
    </button>
  );
};

// Retry Button Component (Currently hidden - uncomment usage in phase components to enable)
// eslint-disable-next-line no-unused-vars
const RetryButton = ({ phaseNumber, onRetry, isRetrying }) => {
  return (
    <div className="retry-button-container">
      <button
        className="phase-retry-button"
        onClick={() => onRetry(phaseNumber)}
        disabled={isRetrying}
      >
        {isRetrying ? '🔄 Retrying...' : '🔄 Retry This Phase'}
      </button>
    </div>
  );
};

// Phase 1 - Prompt Enhancement
const Phase1Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying, onStop, isStopping, chatId }) => {
  if (status === 'pending') {
    return <PendingState message="Phase 1 will start automatically..." />;
  }

  if (status === 'processing') {
    return <ProcessingState message="Enhancing your problem statement with AI..." estimatedTime="30-60 seconds" onStop={() => onStop(phaseNumber)} isStopping={isStopping} />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} />;
  }

  return (
    <div className="phase-completed-content">
      <div className="content-section">
        <h3>📝 Original Problem Statement</h3>
        <div className="content-box">
          <p>{details.originalInput}</p>
        </div>
      </div>

      {details.refinedProblem && (
        <div className="content-section highlight">
          <h3>✨ Refined Problem Statement</h3>
          <div className="content-box refined">
            <p>{details.refinedProblem}</p>
          </div>
        </div>
      )}

      {details.subtopics && details.subtopics.length > 0 && (
        <div className="content-section">
          <h3>🔍 Generated Subtopics ({details.subtopics.length})</h3>
          <div className="subtopics-grid">
            {details.subtopics.map((subtopic, idx) => (
              <div key={idx} className="subtopic-card">
                <span className="subtopic-number">{idx + 1}</span>
                <div>
                  {typeof subtopic === 'string' ? (
                    <p>{subtopic}</p>
                  ) : (
                    <>
                      <h4>{subtopic.title}</h4>
                      {subtopic.description && <p>{subtopic.description}</p>}
                      {subtopic.keywords && subtopic.keywords.length > 0 && (
                        <div className="subtopic-keywords">
                          {subtopic.keywords.map((keyword, kIdx) => (
                            <span key={kIdx} className="keyword-tag">{keyword}</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />
    </div>
  );
};

// Phase 2 - Research Discovery with 3 Tabs
const Phase2Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying, onStop, isStopping, chatId }) => {
  const [activeTab, setActiveTab] = React.useState('papers');

  if (status === 'pending') {
    return <PendingState message="Waiting for Phase 1 to complete..." />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />;
  }

  // Get completion status for each tab
  const papersCompleted = phaseData?.papers?.completed || false;
  const applicationsCompleted = phaseData?.applications?.completed || false;
  const githubCompleted = phaseData?.github?.completed || false;

  const papers = details.papers || [];
  const applications = details.applications || [];
  const githubProjects = details.githubProjects || [];

  const handleStopExecution = () => {
    if (onStop) {
      onStop(phaseNumber);
    }
  };

  return (
    <div className="phase-completed-content phase2-tabs-container">
      {/* Data Summary Status */}
      <div className="phase2-data-summary">
        <div className={`summary-item ${papersCompleted ? 'completed' : 'processing'}`}>
          <span className="summary-icon">📚</span>
          <span className="summary-label">Research Papers</span>
          <span className="summary-status">
            {papersCompleted ? (
              <>✓ {papers.length} found</>
            ) : (
              <>⏳ Searching...</>
            )}
          </span>
        </div>
        <div className={`summary-item ${applicationsCompleted ? 'completed' : 'processing'}`}>
          <span className="summary-icon">🔧</span>
          <span className="summary-label">Applications</span>
          <span className="summary-status">
            {applicationsCompleted ? (
              <>✓ {applications.length} found</>
            ) : (
              <>⏳ Searching...</>
            )}
          </span>
        </div>
        <div className={`summary-item ${githubCompleted ? 'completed' : 'processing'}`}>
          <span className="summary-icon">⭐</span>
          <span className="summary-label">GitHub Projects</span>
          <span className="summary-status">
            {githubCompleted ? (
              <>✓ {githubProjects.length} found</>
            ) : (
              <>⏳ Searching...</>
            )}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="phase2-action-buttons">
        {status === 'processing' && (
          <button 
            className="stop-execution-button" 
            onClick={handleStopExecution}
            disabled={isStopping}
          >
            {isStopping ? '⏳ Stopping...' : '⏹️ Stop Execution'}
          </button>
        )}
        {status === 'completed' && (
          <button 
            className="restart-phase-button"
            onClick={() => onRetry(phaseNumber, false)}
            disabled={isRetrying}
          >
            {isRetrying ? '🔄 Restarting...' : '🔄 Restart Phase 2'}
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="phase2-tabs">
        <button 
          className={`phase2-tab ${activeTab === 'papers' ? 'active' : ''}`}
          onClick={() => setActiveTab('papers')}
        >
          📚 Research Papers
          {!papersCompleted && status === 'processing' && <span className="tab-loading">⏳</span>}
          {papersCompleted && <span className="tab-completed">✓</span>}
        </button>
        <button 
          className={`phase2-tab ${activeTab === 'applications' ? 'active' : ''}`}
          onClick={() => setActiveTab('applications')}
        >
          🔧 Applications
          {!applicationsCompleted && status === 'processing' && <span className="tab-loading">⏳</span>}
          {applicationsCompleted && <span className="tab-completed">✓</span>}
        </button>
        <button 
          className={`phase2-tab ${activeTab === 'github' ? 'active' : ''}`}
          onClick={() => setActiveTab('github')}
        >
          ⭐ GitHub Projects
          {!githubCompleted && status === 'processing' && <span className="tab-loading">⏳</span>}
          {githubCompleted && <span className="tab-completed">✓</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="phase2-tab-content">
        {/* Research Papers Tab */}
        {activeTab === 'papers' && (
          <div className="tab-panel">
            {!papersCompleted ? (
              <div className="tab-loading-state">
                <div className="processing-spinner"></div>
                <h3>Discovering Research Papers...</h3>
                <p>Searching academic databases for relevant papers</p>
              </div>
            ) : (
              <div className="content-section">
                <h3>📚 Discovered Research Papers ({papers.length})</h3>
                {papers.length === 0 ? (
                  <p className="no-data">No papers found</p>
                ) : (
                  <div className="papers-list">
                    {papers.map((paper, idx) => (
                      <div key={idx} className="paper-card">
                        <div className="paper-header">
                          <h4>{paper.title}</h4>
                          {paper.semanticScorePercent && (
                            <span className="semantic-score">
                              Match: {paper.semanticScorePercent}%
                            </span>
                          )}
                        </div>
                        {paper.authors && paper.authors.length > 0 && (
                          <p className="paper-authors">👥 {paper.authors.join(', ')}</p>
                        )}
                        {paper.year && <p className="paper-year">📅 {paper.year}</p>}
                        {paper.abstract && (
                          <p className="paper-abstract">{cleanAbstract(paper.abstract)}</p>
                        )}
                        {paper.pdfLink && (
                          <a href={paper.pdfLink} target="_blank" rel="noopener noreferrer" className="paper-link">
                            📄 View PDF
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Applications Tab */}
        {activeTab === 'applications' && (
          <div className="tab-panel">
            {!applicationsCompleted ? (
              <div className="tab-loading-state">
                <div className="processing-spinner"></div>
                <h3>Finding Existing Applications...</h3>
                <p>Searching for existing solutions and applications</p>
              </div>
            ) : (
              <div className="content-section">
                <h3>🔧 Existing Applications ({applications.length})</h3>
                {applications.length === 0 ? (
                  <p className="no-data">No applications found</p>
                ) : (
                  <div className="applications-list">
                    {applications.map((app, idx) => (
                      <div key={idx} className="application-card">
                        <h4>{app.title}</h4>
                        {app.summary && <p className="app-summary">{app.summary}</p>}
                        {app.features && app.features.length > 0 && (
                          <div className="app-section">
                            <h5>✨ Features</h5>
                            <ul>
                              {app.features.map((feature, i) => (
                                <li key={i}>{feature}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {app.limitations && app.limitations.length > 0 && (
                          <div className="app-section">
                            <h5>⚠️ Limitations</h5>
                            <ul>
                              {app.limitations.map((limitation, i) => (
                                <li key={i}>{limitation}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="app-links">
                          {app.officialWebsite && (
                            <a href={app.officialWebsite} target="_blank" rel="noopener noreferrer">🌐 Website</a>
                          )}
                          {app.documentationLink && (
                            <a href={app.documentationLink} target="_blank" rel="noopener noreferrer">📖 Docs</a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* GitHub Projects Tab */}
        {activeTab === 'github' && (
          <div className="tab-panel">
            {!githubCompleted ? (
              <div className="tab-loading-state">
                <div className="processing-spinner"></div>
                <h3>Searching GitHub Projects...</h3>
                <p>Finding relevant open-source repositories</p>
              </div>
            ) : (
              <div className="content-section">
                <h3>⭐ GitHub Projects ({githubProjects.length})</h3>
                {githubProjects.length === 0 ? (
                  <p className="no-data">No GitHub projects found</p>
                ) : (
                  <div className="github-list">
                    {githubProjects.map((repo, idx) => (
                      <div key={idx} className="github-card">
                        <h4>
                          <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                            {repo.name}
                          </a>
                        </h4>
                        {repo.description && <p className="repo-description">{repo.description}</p>}
                        <div className="repo-stats">
                          <span>⭐ {repo.stargazers_count || 0} stars</span>
                          <span>🍴 {repo.forks_count || 0} forks</span>
                          {repo.language && <span>💻 {repo.language}</span>}
                        </div>
                        {repo.topics && repo.topics.length > 0 && (
                          <div className="repo-topics">
                            {repo.topics.map((topic, i) => (
                              <span key={i} className="topic-tag">{topic}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Phase 3 - Analysis & Synthesis
const Phase3Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying, onStop, isStopping, chatId }) => {
  const [activeTab, setActiveTab] = React.useState('researchPapers');
  
  if (status === 'pending') {
    return <PendingState message="Waiting for Phase 2 to complete..." />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />;
  }

  // Get sub-phase data
  const researchPaperAnalysis = phaseData.researchPaperAnalysis || {};
  const githubAnalysis = phaseData.githubAnalysis || {};

  // Handle processing state
  if (status === 'processing') {
    return <ProcessingState message="Running parallel analysis..." estimatedTime="15-20 minutes" onStop={() => onStop(phaseNumber)} isStopping={isStopping} />;
  }

  // Completed state - show tabs
  return (
    <div className="phase-completed-content">
      {/* Restart Button */}
      <div className="phase3-restart-button-container">
        <button 
          className="restart-phase-button"
          onClick={() => onRetry(phaseNumber, false)}
          disabled={isRetrying}
        >
          {isRetrying ? '🔄 Restarting...' : '🔄 Restart Phase 3'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="phase2-tabs">
        <button
          className={`phase2-tab ${activeTab === 'researchPapers' ? 'active' : ''}`}
          onClick={() => setActiveTab('researchPapers')}
        >
          📄 Research Paper Analysis
          {researchPaperAnalysis.completed && <span className="tab-badge">✓</span>}
        </button>
        <button
          className={`phase2-tab ${activeTab === 'github' ? 'active' : ''}`}
          onClick={() => setActiveTab('github')}
        >
          🔧 GitHub Project Analysis
          {githubAnalysis.completed && <span className="tab-badge">✓</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="phase2-tab-content">
        {/* Research Paper Analysis Tab */}
        {activeTab === 'researchPapers' && (
          <div className="tab-pane">
            {!researchPaperAnalysis.completed ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Analyzing research papers...</p>
              </div>
            ) : researchPaperAnalysis.error ? (
              <ErrorState error={researchPaperAnalysis.error} />
            ) : (
              <div className="content-section">
                <h3>📄 Research Paper Analysis ({Array.isArray(researchPaperAnalysis.data) ? researchPaperAnalysis.data.length : 0})</h3>
                {researchPaperAnalysis.data && Array.isArray(researchPaperAnalysis.data) ? (
                  <div className="paper-analysis-list">
                    {researchPaperAnalysis.data.map((paper, idx) => (
                      <div key={paper.pdf_link || idx} className="paper-analysis-card">
                        <div className="paper-header">
                          <h4>📑 {paper.title || `Paper #${idx + 1}`}</h4>
                          {paper.pdf_link && (
                            <a 
                              href={paper.pdf_link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="pdf-link"
                            >
                              🔗 View PDF
                            </a>
                          )}
                        </div>
                        
                        {/* Relevance Reasons */}
                        {paper.relevance_reason && Array.isArray(paper.relevance_reason) && paper.relevance_reason.length > 0 && (
                          <div className="relevance-reason-section">
                            <div className="relevance-badge">
                              <span className="relevance-icon">🎯</span>
                              <span className="relevance-label">Research Relevance</span>
                            </div>
                            <ul className="relevance-list">
                              {paper.relevance_reason.map((reason, rIdx) => (
                                <li key={rIdx} className="relevance-item">{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div className="analysis-sections">
                          {/* Summary */}
                          {paper.summary && (
                            <div className="analysis-section">
                              <h5>📋 Summary</h5>
                              <p className="section-text">{paper.summary}</p>
                            </div>
                          )}
                          
                          {/* Methodology */}
                          {paper.methodology && (
                            <div className="analysis-section">
                              <h5>🔬 Methodology</h5>
                              <p className="section-text">{paper.methodology}</p>
                            </div>
                          )}
                          
                          {/* Algorithms Used */}
                          {paper.algorithms_used && Array.isArray(paper.algorithms_used) && paper.algorithms_used.length > 0 && (
                            <div className="analysis-section">
                              <h5>⚙️ Algorithms & Techniques</h5>
                              <div className="algorithms-grid">
                                {paper.algorithms_used.map((algo, i) => (
                                  <span key={i} className="algorithm-tag">{algo}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Results */}
                          {paper.result && (
                            <div className="analysis-section">
                              <h5>📊 Results</h5>
                              <p className="section-text">{paper.result}</p>
                            </div>
                          )}
                          
                          {/* Conclusion */}
                          {paper.conclusion && (
                            <div className="analysis-section">
                              <h5>✅ Conclusion</h5>
                              <p className="section-text">{paper.conclusion}</p>
                            </div>
                          )}
                          
                          {/* Limitations */}
                          {paper.limitations && (
                            <div className="analysis-section limitations">
                              <h5>⚠️ Limitations</h5>
                              <p className="section-text">{paper.limitations}</p>
                            </div>
                          )}
                          
                          {/* Future Scope */}
                          {paper.future_scope && (
                            <div className="analysis-section future-scope">
                              <h5>🚀 Future Scope</h5>
                              <p className="section-text">{paper.future_scope}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">No analysis data available</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* GitHub Project Analysis Tab */}
        {activeTab === 'github' && (
          <div className="tab-pane">
            {!githubAnalysis.completed ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Analyzing GitHub projects...</p>
              </div>
            ) : githubAnalysis.error ? (
              <ErrorState error={githubAnalysis.error} />
            ) : (
              <div className="content-section">
                <h3>🔧 GitHub Project Analysis ({Array.isArray(githubAnalysis.data) ? githubAnalysis.data.length : 0})</h3>
                {githubAnalysis.data && Array.isArray(githubAnalysis.data) ? (
                  <div className="github-analysis-list">
                    {githubAnalysis.data.map((project, idx) => (
                      <div key={project.id || idx} className="github-analysis-card">
                        <div className="project-header">
                          <h4>Project #{idx + 1}</h4>
                          <span className="project-id">ID: {project.id}</span>
                        </div>
                        
                        {project.sections ? (
                          <div className="analysis-sections">
                            {/* Project Intent */}
                            {project.sections["Project Intent"] && (
                              <div className="analysis-section">
                                <h5>🎯 Project Intent</h5>
                                <ul>
                                  {project.sections["Project Intent"].map((item, i) => (
                                    <li key={i}>{item.replace(/^-\s*/, '')}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Target Users */}
                            {project.sections["Target Users"] && (
                              <div className="analysis-section">
                                <h5>👥 Target Users</h5>
                                <ul>
                                  {project.sections["Target Users"].map((item, i) => (
                                    <li key={i}>{item.replace(/^-\s*/, '')}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Core Capabilities */}
                            {project.sections["Core Capabilities"] && (
                              <div className="analysis-section">
                                <h5>⚙️ Core Capabilities</h5>
                                <ul>
                                  {project.sections["Core Capabilities"].map((item, i) => (
                                    <li key={i}>{item.replace(/^-\s*/, '')}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* AI/LLM Readiness */}
                            {project.sections["AI / LLM Readiness"] && (
                              <div className="analysis-section">
                                <h5>🤖 AI / LLM Readiness</h5>
                                <ul>
                                  {project.sections["AI / LLM Readiness"].map((item, i) => (
                                    <li key={i}>{item.replace(/^-\s*/, '')}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Strengths */}
                            {project.sections["Strengths"] && (
                              <div className="analysis-section">
                                <h5>✨ Strengths</h5>
                                <ul>
                                  {project.sections["Strengths"].map((item, i) => (
                                    <li key={i}>{item.replace(/^-\s*/, '')}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Limitations */}
                            {project.sections["Limitations"] && (
                              <div className="analysis-section">
                                <h5>⚠️ Limitations</h5>
                                <ul>
                                  {project.sections["Limitations"].map((item, i) => (
                                    <li key={i}>{item.replace(/^-\s*/, '')}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {/* Overall Assessment */}
                            {project.sections["Overall Assessment"] && (
                              <div className="analysis-section overall-assessment">
                                <h5>📊 Overall Assessment</h5>
                                <div className="assessment-content">
                                  {project.sections["Overall Assessment"].map((item, i) => (
                                    <p key={i}>{item.replace(/^-\s*/, '')}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="no-data">No analysis sections available for this project</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-data">No analysis data available</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Phase 4 - Gap Finder
const Phase4Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying, onStop, isStopping, chatId }) => {
  if (status === 'pending') {
    return <PendingState message="Waiting for Phase 3 to complete..." />;
  }

  if (status === 'processing') {
    return <ProcessingState message="Analyzing research gaps and opportunities..." estimatedTime="2-3 minutes" onStop={() => onStop(phaseNumber)} isStopping={isStopping} />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} />;
  }

  // Phase 4 data comes as an array with one object
  let gapAnalysis = details.phase4GapAnalysis;
  
  // If it's an array, get the first element
  if (Array.isArray(gapAnalysis) && gapAnalysis.length > 0) {
    gapAnalysis = gapAnalysis[0];
  }

  if (!gapAnalysis) {
    return (
      <div className="phase-completed-content">
        <p className="no-data">No gap analysis data available yet</p>
        <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />
      </div>
    );
  }

  return (
    <div className="phase-completed-content">
      {/* Evidence-Based Gaps */}
      {gapAnalysis.evidence_based_gaps && gapAnalysis.evidence_based_gaps.length > 0 && (
        <div className="content-section">
          <h3>🔍 Evidence-Based Gaps ({gapAnalysis.evidence_based_gaps.length})</h3>
          <ul className="gap-bullet-list">
            {gapAnalysis.evidence_based_gaps.map((item, idx) => (
              <li key={idx}>{item.gap}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Research Gaps from Papers with Evidence */}
      {gapAnalysis.research_gaps_from_papers && gapAnalysis.research_gaps_from_papers.length > 0 && (
        <div className="content-section">
          <h3>📄 Research Gaps from Papers with Evidence ({gapAnalysis.research_gaps_from_papers.length})</h3>
          {gapAnalysis.research_gaps_from_papers.map((item, idx) => (
            <div key={idx} style={{
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: '#f7fafc',
              borderRadius: '8px',
              borderLeft: '4px solid #667eea'
            }}>
              <h4 style={{ 
                color: '#2d3748', 
                marginBottom: '12px',
                fontSize: '1rem',
                fontWeight: '600'
              }}>
                {idx + 1}. {typeof item === 'string' ? item : item.gap}
              </h4>
              
              {item.evidence && item.evidence.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ 
                    fontWeight: '600', 
                    color: '#667eea',
                    fontSize: '0.9rem',
                    marginBottom: '8px'
                  }}>
                    Supporting Evidence ({item.evidence.length} papers):
                  </div>
                  {item.evidence.map((ev, evIdx) => (
                    <div key={evIdx} style={{
                      marginBottom: '12px',
                      padding: '12px',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{ 
                        fontWeight: '600',
                        color: '#4a5568',
                        fontSize: '0.85rem',
                        marginBottom: '6px'
                      }}>
                        📖 {ev.paper}
                      </div>
                      <div style={{
                        color: '#718096',
                        fontSize: '0.85rem',
                        fontStyle: 'italic',
                        lineHeight: '1.5'
                      }}>
                        "{ev.limitation_reference}"
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AI Predicted Possible Gaps */}
      {gapAnalysis.ai_predicted_possible_gaps && gapAnalysis.ai_predicted_possible_gaps.length > 0 && (
        <div className="content-section">
          <h3>🤖 AI-Predicted Possible Gaps ({gapAnalysis.ai_predicted_possible_gaps.length})</h3>
          <ul className="gap-bullet-list">
            {gapAnalysis.ai_predicted_possible_gaps.map((item, idx) => (
              <li key={idx}>{item.predicted_gap || item}</li>
            ))}
          </ul>
        </div>
      )}

      <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />
    </div>
  );
};

// Phase 5 - Literature Review
const Phase5Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying, onStop, isStopping, chatId }) => {
  if (status === 'pending') {
    return <PendingState message="Waiting for Phase 4 to complete..." />;
  }

  if (status === 'processing') {
    return <ProcessingState message="Generating comprehensive literature review..." estimatedTime="2-3 minutes" onStop={() => onStop(phaseNumber)} isStopping={isStopping} />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />;
  }

  const literatureReview = details.phase5LiteratureReview;

  if (!literatureReview) {
    return (
      <div className="phase-completed-content">
        <p className="no-data">No literature review data available yet</p>
        <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />
      </div>
    );
  }

  // Helper function to render markdown-like text
  const renderMarkdownText = (text) => {
    if (!text) return null;
    
    return text.split('\n\n').map((paragraph, idx) => {
      // Check if it's a heading
      if (paragraph.startsWith('###')) {
        const heading = paragraph.replace(/^###\s*/, '');
        return <h4 key={idx} style={{ marginTop: '24px', marginBottom: '12px', color: '#667eea' }}>{heading}</h4>;
      } else if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
        const bold = paragraph.replace(/\*\*/g, '');
        return <h5 key={idx} style={{ marginTop: '16px', marginBottom: '8px', fontWeight: '600' }}>{bold}</h5>;
      } else if (paragraph.startsWith('*   **')) {
        // List item with bold start
        const content = paragraph.replace(/^\*\s+\*\*/, '').replace(/\*\*/g, '');
        return <li key={idx} style={{ marginBottom: '12px' }}>{content}</li>;
      } else if (paragraph.startsWith('*   ')) {
        // Regular list item
        const content = paragraph.replace(/^\*\s+/, '');
        return <li key={idx} style={{ marginBottom: '8px' }}>{content}</li>;
      } else if (paragraph.match(/^\d+\.\s+\*\*/)) {
        // Numbered list item with bold
        const content = paragraph.replace(/^\d+\.\s+\*\*/, '').replace(/\*\*/g, '');
        return <li key={idx} style={{ marginBottom: '12px' }}>{content}</li>;
      } else if (paragraph.match(/^\d+\.\s+/)) {
        // Regular numbered list item
        const content = paragraph.replace(/^\d+\.\s+/, '');
        return <li key={idx} style={{ marginBottom: '8px' }}>{content}</li>;
      } else {
        // Regular paragraph - render with bold formatting
        const parts = paragraph.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={idx} style={{ marginBottom: '12px', lineHeight: '1.6' }}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.replace(/\*\*/g, '')}</strong>;
              }
              return part;
            })}
          </p>
        );
      }
    });
  };

  return (
    <div className="phase-completed-content">
      {/* Full Literature Review Text */}
      {literatureReview.literature_review && (
        <div className="content-section">
          <h3>📚 Comprehensive Literature Review</h3>
          <div className="literature-text" style={{ 
            backgroundColor: '#f7fafc', 
            padding: '20px', 
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            {renderMarkdownText(literatureReview.literature_review)}
          </div>
        </div>
      )}

      {/* Academic Trends */}
      {literatureReview.academic_trends && literatureReview.academic_trends.length > 0 && (
        <div className="content-section">
          <h3>🎓 Academic Research Trends ({literatureReview.academic_trends.length})</h3>
          <ul className="bullet-list">
            {literatureReview.academic_trends.map((trend, idx) => (
              <li key={idx}>{trend}</li>
            ))}
          </ul>
        </div>
      )}

      <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />
    </div>
  );
};

// Phase 6 - Best Solution (displays as Phase 6 in frontend)
const Phase6Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying, chatId, onStop, isStopping }) => {
  if (status === 'pending') {
    return <PendingState message="Waiting for Phase 5 to complete..." />;
  }

  if (status === 'processing') {
    return <ProcessingState message="Creating the best comprehensive solution..." estimatedTime="4-5 minutes" onStop={() => onStop(phaseNumber)} isStopping={isStopping} />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />;
  }

  const solution = details.phase6Solution;

  if (!solution) {
    return <p className="no-data">No final solution generated yet</p>;
  }

  return (
    <div className="phase-completed-content phase6-special">
      {/* Retry Button at the top */}
      <div className="retry-button-container" style={{ marginBottom: '1.5rem' }}>
        <button
          className="phase-retry-button"
          onClick={() => onRetry(phaseNumber)}
          disabled={isRetrying}
        >
          {isRetrying ? '🔄 Retrying...' : '🔄 Retry Phase 6 (Best Solution)'}
        </button>
      </div>

      {solution.proposedSolution && (
        <div className="content-section hero-section">
          <h3>🏆 Proposed Solution</h3>
          <div className="hero-content">
            <p>{solution.proposedSolution}</p>
          </div>
        </div>
      )}

      {solution.problemUnderstanding && (
        <div className="content-section">
          <h3>🎯 Problem Understanding</h3>
          <p>{solution.problemUnderstanding}</p>
        </div>
      )}

      {solution.solutionArchitecture && solution.solutionArchitecture.length > 0 && (
        <div className="content-section">
          <h3>🏗️ Solution Architecture</h3>
          <ul className="architecture-list">
            {solution.solutionArchitecture.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {solution.implementationWorkflow && solution.implementationWorkflow.length > 0 && (
        <div className="content-section">
          <h3>🛠️ Implementation Workflow</h3>
          {solution.implementationWorkflow.map((phase, idx) => (
            <div key={idx} className="workflow-phase">
              <h4>{phase.phaseTitle}</h4>
              <ul>
                {phase.steps.map((step, sIdx) => (
                  <li key={sIdx}>{step}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {solution.recommendedTechStack && solution.recommendedTechStack.length > 0 && (
        <div className="content-section">
          <h3>💻 Recommended Tech Stack</h3>
          {solution.recommendedTechStack.map((stack, idx) => (
            <div key={idx} className="tech-stack-section">
              <h4>{stack.title}</h4>
              <div className="tech-tags">
                {stack.items.map((item, iIdx) => (
                  <span key={iIdx} className="tech-tag">{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {solution.scoringByFactors && solution.scoringByFactors.length > 0 && (
        <div className="content-section">
          <h3>📊 Scoring by Factors</h3>
          <div className="scoring-grid">
            {solution.scoringByFactors.map((score, idx) => (
              <div key={idx} className="score-card">
                <div className="score-header">
                  <h4>{score.title}</h4>
                  <span className="score-rating">{score.rating}/10</span>
                </div>
                <p>{score.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {solution.limitations && solution.limitations.length > 0 && (
        <div className="content-section warning-section">
          <h3>⚠️ Limitations & Open Questions</h3>
          <ul>
            {solution.limitations.map((limitation, idx) => (
              <li key={idx}>{limitation}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="completion-badge-large">
        🎉 Research Complete - All Phases Finished
      </div>

      <div className="download-report-section">
        <DownloadReportButton chatId={chatId} />
      </div>
    </div>
  );
};

// Helper Components
const PendingState = ({ message }) => (
  <div className="phase-state pending-state">
    <div className="state-icon">⏳</div>
    <h3>Phase Pending</h3>
    <p>{message}</p>
  </div>
);

const ProcessingState = ({ message, estimatedTime, onStop, isStopping }) => (
  <div className="phase-state processing-state">
    <div className="processing-spinner"></div>
    <h3>Processing...</h3>
    <p>{message}</p>
    {estimatedTime && (
      <p className="estimated-time">⏱️ Estimated time: {estimatedTime}</p>
    )}
    {onStop && (
      <button 
        className="stop-phase-btn" 
        onClick={onStop}
        disabled={isStopping}
        style={{
          marginTop: '20px',
          padding: '12px 24px',
          backgroundColor: isStopping ? '#cbd5e0' : '#e53e3e',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: isStopping ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '20px auto 0'
        }}
      >
        {isStopping ? '⏳ Stopping...' : '🛑 Stop Phase'}
      </button>
    )}
  </div>
);

const ErrorState = ({ error, phaseNumber, onRetry, isRetrying }) => (
  <div className="phase-state error-state">
    <div className="state-icon">❌</div>
    <h3>Phase Failed</h3>
    <p>{error || 'An error occurred during processing'}</p>
    {onRetry && phaseNumber && (
      <button
        className="phase-retry-button"
        onClick={() => onRetry(phaseNumber)}
        disabled={isRetrying}
        style={{ marginTop: '1rem' }}
      >
        {isRetrying ? '🔄 Retrying...' : `🔄 Retry Phase ${phaseNumber}`}
      </button>
    )}
  </div>
);

export default PhaseContent;
