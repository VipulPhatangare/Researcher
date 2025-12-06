import React from 'react';
import { cleanAbstract } from '../utils/textCleaner';
import './PhaseContent.css';
import ChatPhase from './ChatPhase';

const PhaseContent = ({ phaseNumber, sessionData, chatId, onRetry, isRetrying }) => {
  const { details } = sessionData;
  const phaseKey = `phase${phaseNumber}`;
  const phaseData = details?.phases?.[phaseKey];
  const phaseStatus = phaseData?.status || 'pending';

  // Phase-specific rendering
  const renderPhaseContent = () => {
    switch (phaseNumber) {
      case 1:
        return <Phase1Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />;
      case 2:
        return <Phase2Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />;
      case 3:
        return <Phase3Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />;
      case 4:
        return <Phase4Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />;
      case 5:
        return <Phase5Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} />;
      case 6:
        return <Phase6Content details={details} phaseData={phaseData} status={phaseStatus} phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} chatId={chatId} />;
      case 7:
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
      console.error('Download error:', error);
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
const Phase1Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying }) => {
  if (status === 'pending') {
    return <PendingState message="Phase 1 will start automatically..." />;
  }

  if (status === 'processing') {
    return <ProcessingState message="Enhancing your problem statement with AI..." estimatedTime="30-60 seconds" />;
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

      {/* <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} /> */}
    </div>
  );
};

// Phase 2 - Research Discovery
const Phase2Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying }) => {
  if (status === 'pending') {
    return <PendingState message="Waiting for Phase 1 to complete..." />;
  }

  if (status === 'processing') {
    return <ProcessingState message="Discovering relevant research papers..." estimatedTime="2-3 minutes" />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} />;
  }

  const papers = details.papers || [];

  return (
    <div className="phase-completed-content">
      <div className="content-section">
        <h3>📚 Discovered Research Papers ({papers.length})</h3>
        
        {papers.length === 0 ? (
          <p className="no-data">No papers found yet</p>
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
                  <p className="paper-authors">
                    👥 {paper.authors.join(', ')}
                  </p>
                )}
                
                {paper.year && (
                  <p className="paper-year">📅 {paper.year}</p>
                )}
                
                {paper.abstract && (
                  <p className="paper-abstract">{cleanAbstract(paper.abstract)}</p>
                )}
                
                {paper.pdfLink && (
                  <a 
                    href={paper.pdfLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="paper-link"
                  >
                    📄 View PDF
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} /> */}
    </div>
  );
};

// Phase 3 - Analysis & Synthesis
const Phase3Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying }) => {
  if (status === 'pending') {
    return <PendingState message="Waiting for Phase 2 to complete..." />;
  }

  if (status === 'processing') {
    return <ProcessingState message="Analyzing research papers in depth..." estimatedTime="7-8 minutes" />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} />;
  }

  const analyzedPapers = details.papers?.filter(p => p.summary || p.methodology) || [];

  return (
    <div className="phase-completed-content">
      <div className="content-section">
        <h3>🧪 Analyzed Papers ({analyzedPapers.length})</h3>
        
        {analyzedPapers.length === 0 ? (
          <p className="no-data">No analyzed papers yet</p>
        ) : (
          <div className="analyzed-papers-list">
            {analyzedPapers.map((paper, idx) => (
              <div key={idx} className="analyzed-paper-card">
                <h4>{paper.title}</h4>
                
                {paper.summary && (
                  <div className="analysis-section">
                    <h5>📋 Summary</h5>
                    <p>{paper.summary}</p>
                  </div>
                )}
                
                {paper.methodology && (
                  <div className="analysis-section">
                    <h5>🔬 Methodology</h5>
                    <p>{paper.methodology}</p>
                  </div>
                )}
                
                {paper.algorithmsUsed && paper.algorithmsUsed.length > 0 && (
                  <div className="analysis-section">
                    <h5>⚙️ Algorithms Used</h5>
                    <div className="tags-list">
                      {paper.algorithmsUsed.map((algo, i) => (
                        <span key={i} className="tag">{algo}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {paper.result && (
                  <div className="analysis-section">
                    <h5>📊 Results</h5>
                    <p>{paper.result}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} /> */}
    </div>
  );
};

// Phase 4 - Research Analysis
const Phase4Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying }) => {
  if (status === 'pending') {
    return <PendingState message="Waiting for Phase 3 to complete..." />;
  }

  if (status === 'processing') {
    return <ProcessingState message="Analyzing research methodologies and technologies..." estimatedTime="2-3 minutes" />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} />;
  }

  const analysis = details.phase4Analysis;

  return (
    <div className="phase-completed-content">
      {analysis?.mostCommonMethodologies && analysis.mostCommonMethodologies.length > 0 && (
        <div className="content-section">
          <h3>📊 Most Common Methodologies</h3>
          <div className="items-list">
            {analysis.mostCommonMethodologies.map((item, idx) => (
              <div key={idx} className="analysis-item">
                <span className="item-icon">🔹</span>
                {typeof item === 'string' ? (
                  <p>{item}</p>
                ) : (
                  <div>
                    <h4>{item.title}</h4>
                    {item.description && <p>{item.description}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis?.technologyOrAlgorithms && analysis.technologyOrAlgorithms.length > 0 && (
        <div className="content-section">
          <h3>💻 Technologies & Algorithms</h3>
          <div className="items-list">
            {analysis.technologyOrAlgorithms.map((item, idx) => (
              <div key={idx} className="analysis-item">
                <span className="item-icon">⚡</span>
                {typeof item === 'string' ? (
                  <p>{item}</p>
                ) : (
                  <div>
                    <h4>{item.title}</h4>
                    {item.description && <p>{item.description}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis?.datasetsUsed && analysis.datasetsUsed.length > 0 && (
        <div className="content-section">
          <h3>📁 Datasets Used</h3>
          <div className="items-list">
            {analysis.datasetsUsed.map((item, idx) => (
              <div key={idx} className="analysis-item">
                <span className="item-icon">📊</span>
                {typeof item === 'string' ? (
                  <p>{item}</p>
                ) : (
                  <div>
                    <h4>{item.title}</h4>
                    {item.description && <p>{item.description}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis?.uniqueOrLessCommonApproaches && analysis.uniqueOrLessCommonApproaches.length > 0 && (
        <div className="content-section highlight">
          <h3>💡 Unique Approaches</h3>
          <div className="items-list">
            {analysis.uniqueOrLessCommonApproaches.map((item, idx) => (
              <div key={idx} className="analysis-item">
                <span className="item-icon">✨</span>
                {typeof item === 'string' ? (
                  <p>{item}</p>
                ) : (
                  <div>
                    <h4>{item.title}</h4>
                    {item.description && <p>{item.description}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} /> */}
    </div>
  );
};

// Phase 5 - Existing Solutions & Applications
const Phase5Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying }) => {
  if (status === 'pending') {
    return <PendingState message="Waiting for Phase 4 to complete..." />;
  }

  if (status === 'processing') {
    return <ProcessingState message="Finding existing solutions and applications..." estimatedTime="2-3 minutes" />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} />;
  }

  const solutions = details.phase5Solutions || [];

  return (
    <div className="phase-completed-content">
      <div className="content-section">
        <h3>🔧 Existing Solutions & Applications ({solutions.length})</h3>
        
        {solutions.length === 0 ? (
          <p className="no-data">No solutions generated yet</p>
        ) : (
          <div className="solutions-grid">
            {solutions.map((solution, idx) => (
              <div key={idx} className="solution-card">
                <div className="solution-header">
                  <h4>{solution.title}</h4>
                </div>
                
                {solution.summary && (
                  <p className="solution-summary">{solution.summary}</p>
                )}
                
                {solution.features && solution.features.length > 0 && (
                  <div className="solution-section">
                    <h5>✨ Features</h5>
                    <ul>
                      {solution.features.map((feature, i) => (
                        <li key={i}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="solution-meta">
                  {solution.platformType && (
                    <span className="meta-tag">📱 {solution.platformType}</span>
                  )}
                  {solution.pricingOrLicense && (
                    <span className="meta-tag">💰 {solution.pricingOrLicense}</span>
                  )}
                </div>
                
                {solution.officialWebsite && (
                  <a 
                    href={solution.officialWebsite} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="solution-link"
                  >
                    🌐 Visit Website
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} /> */}
    </div>
  );
};

// Phase 6 - Best Solution
const Phase6Content = ({ details, phaseData, status, phaseNumber, onRetry, isRetrying, chatId }) => {
  if (status === 'pending') {
    return <PendingState message="Waiting for Phase 5 to complete..." />;
  }

  if (status === 'processing') {
    return <ProcessingState message="Creating the best comprehensive solution..." estimatedTime="4-5 minutes" />;
  }

  if (status === 'failed') {
    return <ErrorState error={phaseData.error} />;
  }

  const solution = details.phase6Solution;

  if (!solution) {
    return <p className="no-data">No final solution generated yet</p>;
  }

  return (
    <div className="phase-completed-content phase6-special">
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

      {/* <RetryButton phaseNumber={phaseNumber} onRetry={onRetry} isRetrying={isRetrying} /> */}
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

const ProcessingState = ({ message, estimatedTime }) => (
  <div className="phase-state processing-state">
    <div className="processing-spinner"></div>
    <h3>Processing...</h3>
    <p>{message}</p>
    {estimatedTime && (
      <p className="estimated-time">⏱️ Estimated time: {estimatedTime}</p>
    )}
  </div>
);

const ErrorState = ({ error }) => (
  <div className="phase-state error-state">
    <div className="state-icon">❌</div>
    <h3>Phase Failed</h3>
    <p>{error || 'An error occurred during processing'}</p>
  </div>
);

export default PhaseContent;
