import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Landing.css';
import Navbar from './Navbar';

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Navbar />
      <div className="landing-container">
        <div className="landing-content">
          {!isAuthenticated ? (
            <div className="landing-header">
              <h1>Researcher</h1>
              <p className="landing-subtitle">
                Your intelligent companion for comprehensive research and solution discovery
              </p>
              <p className="landing-subtitle-secondary">
                Please login or sign up to start your research journey
              </p>
            </div>
          ) : (
            <>
              <div className="landing-header">
                <h1>Researcher</h1>
                <p className="landing-subtitle">
                  Your intelligent companion for comprehensive research and solution discovery
                </p>
              </div>

              <div className="landing-options">
                <div 
                  className="landing-card new-research"
                  onClick={() => navigate('/new-research')}
                >
                  <div className="card-icon">✨</div>
                  <h2>Start New Research</h2>
                  <p>Begin a fresh research journey with AI-powered analysis</p>
                  <button className="card-button primary">Get Started</button>
                </div>

                <div 
                  className="landing-card previous-research"
                  onClick={() => navigate('/sessions')}
                >
                  <div className="card-icon">📚</div>
                  <h2>Previous Research</h2>
                  <p>View and continue your past research sessions</p>
                  <button className="card-button secondary">View Sessions</button>
                </div>
              </div>
            </>
          )}

          <div className="landing-features">
            <h3 className="features-title">Powerful Research Features</h3>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">🎯</div>
                <h4>6-Phase Analysis</h4>
                <p>Comprehensive research workflow from problem refinement to solution generation</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🤖</div>
                <h4>AI-Powered Insights</h4>
                <p>Advanced AI models analyze papers, identify gaps, and generate solutions</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h4>Comprehensive Reports</h4>
                <p>Detailed literature reviews, gap analysis, and actionable recommendations</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h4>Parallel Processing</h4>
                <p>Analyze multiple research papers and GitHub repositories simultaneously</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💬</div>
                <h4>Interactive Chat</h4>
                <p>Ask questions and get clarifications about your research findings</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📥</div>
                <h4>Export & Share</h4>
                <p>Download complete research reports in multiple formats</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Landing;
