import React from 'react';
import './Modal.css';

const InfoModal = ({ onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">About Researcher</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="info-content">
            <p>
              <strong>Researcher</strong> is an intelligent AI-powered research platform that transforms your problem 
              statement into comprehensive, research-backed solutions. Our automated system guides you through 
              6 intelligent phases, leveraging advanced AI to deliver actionable insights and academic resources.
            </p>

            <h3>How It Works - 6 Phase Process</h3>
            <ul className="phase-list">
              <li>
                <strong>Phase 1: Problem Understanding & Analysis</strong>
                <br/>Our AI analyzes your problem statement to identify key themes, generates relevant subtopics, 
                and extracts critical keywords that define your research scope.
                <br/><em>⏱️ Estimated time: 2-3 minutes</em>
              </li>

              <li>
                <strong>Phase 2: Problem Refinement & Vectorization</strong>
                <br/>Refines your problem with expert-level clarity, generates semantic embeddings for intelligent 
                matching, and structures your research direction for optimal discovery.
                <br/><em>⏱️ Estimated time: 2-3 minutes</em>
              </li>

              <li>
                <strong>Phase 3: Literature Discovery & Retrieval</strong>
                <br/>Automatically searches academic databases and retrieves highly relevant research papers, 
                filtered by relevance, recency, and impact factor to ensure quality sources.
                <br/><em>⏱️ Estimated time: 2-3 minutes</em>
              </li>

              <li>
                <strong>Phase 4: Solution Synthesis & Recommendations</strong>
                <br/>Analyzes retrieved papers to extract methodologies, patterns, and trends. Delivers a comprehensive 
                solution with architecture, implementation workflow, tech stack recommendations, and datasets.
                <br/><em>⏱️ Estimated time: 4-5 minutes</em>
              </li>

              <li>
                <strong>Phase 5: Interactive Research Chat</strong>
                <br/>AI-powered chat assistant that answers follow-up questions, provides clarifications, and offers 
                deeper insights based on your complete research context. Available immediately after Phase 4.
                <br/><em>⏱️ Always available</em>
              </li>

              <li>
                <strong>Phase 6: Solution Refinement (Optional)</strong>
                <br/>If the initial solution doesn't meet your expected outcome, provide your requirements and the 
                system intelligently refines the solution with focused re-analysis and enhanced recommendations.
                <br/><em>⏱️ Estimated time: 4-5 minutes</em>
              </li>
            </ul>
            
            <p style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#e6f3ff', borderRadius: '6px', fontSize: '0.95rem' }}>
              <strong>📊 Total Time:</strong> 10-14 minutes for complete research cycle | <strong>💾 Auto-save:</strong> All progress saved in your browser
            </p>

            <h3>Key Features</h3>
            <ul style={{ listStyle: 'disc', paddingLeft: '2rem', marginBottom: '1rem' }}>
              <li><strong>Parallel Processing:</strong> Multiple phases run simultaneously for faster results</li>
              <li><strong>Smart Retry:</strong> Refine solutions that don't meet your expectations</li>
              <li><strong>Academic Sources:</strong> Access to research papers from trusted databases</li>
              <li><strong>Export Options:</strong> Download reports in PDF or structured formats</li>
              <li><strong>Session Management:</strong> Maintain multiple research sessions with automatic saving</li>
              <li><strong>Real-time Chat:</strong> Interactive AI assistant available throughout your research journey</li>
            </ul>

            <h3>Best For</h3>
            <p>
              Students, researchers, academics, and industry professionals conducting literature reviews, 
              exploring research problems, seeking implementation guidance, or developing research proposals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
