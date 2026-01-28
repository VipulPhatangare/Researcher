import React, { useState, useEffect } from 'react';
import './FeedbackModal.css';

const FeedbackModal = ({ isOpen, onClose }) => {
  const [ratings, setRatings] = useState({
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
    q5: 0,
    q6: 0,
    q7: 0,
    q8: 0,
    q9: 0,
    q10: 0
  });
  const [feedback, setFeedback] = useState('');
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const questions = [
    {
      id: 'q1',
      text: '🎯 How well did the system understand your research problem?',
      subtitle: '(1 = Completely missed the point, 5 = Perfectly understood)'
    },
    {
      id: 'q2',
      text: '🔑 How useful were the generated keywords and subtopics?',
      subtitle: '(1 = Not relevant, 5 = Extremely useful for defining research direction)'
    },
    {
      id: 'q3',
      text: '📚 How relevant were the retrieved research papers?',
      subtitle: '(1 = Off-topic papers, 5 = Highly relevant and directly applicable)'
    },
    {
      id: 'q4',
      text: '📊 How satisfied are you with paper organization and filtering?',
      subtitle: '(1 = Poor organization, 5 = Well-filtered by relevance, recency, and impact)'
    },
    {
      id: 'q5',
      text: '🔬 How helpful was the methodology and pattern extraction?',
      subtitle: '(1 = Not insightful, 5 = Very helpful in understanding research trends)'
    },
    {
      id: 'q6',
      text: '✨ How effective was the final solution synthesis?',
      subtitle: '(1 = Incomplete/unclear, 5 = Comprehensive and actionable solution)'
    },
    {
      id: 'q7',
      text: '💬 How easy was it to use the research chat assistant?',
      subtitle: '(1 = Confusing and difficult, 5 = Very intuitive and helpful)'
    },
    {
      id: 'q8',
      text: '✅ How accurate and reliable were the AI responses?',
      subtitle: '(1 = Inaccurate/speculative, 5 = Highly accurate and fact-based)'
    },
    {
      id: 'q9',
      text: '💡 How valuable is this tool for real research work?',
      subtitle: '(1 = Limited value, 5 = High practical value for students/researchers)'
    },
    {
      id: 'q10',
      text: '⭐ How likely are you to recommend this platform?',
      subtitle: '(1 = Would not recommend, 5 = Definitely will recommend to others)'
    }
  ];

  useEffect(() => {
    const checkFeedbackStatus = async () => {
      if (isOpen) {
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
          try {
            const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/feedback/check/${encodeURIComponent(userEmail)}`);
            const data = await response.json();
            setAlreadySubmitted(data.hasSubmitted);
          } catch (error) {
            // console.error('Error checking feedback status:', error);
          }
        }
      }
    };
    checkFeedbackStatus();
  }, [isOpen]);

  const handleRatingChange = (questionId, value) => {
    setRatings(prev => ({ ...prev, [questionId]: value }));
    setErrors(prev => ({ ...prev, [questionId]: false }));
  };

  const validateForm = () => {
    const newErrors = {};
    questions.forEach(q => {
      if (ratings[q.id] === 0) {
        newErrors[q.id] = true;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert('Please rate all questions before submitting.');
      return;
    }

    try {
      const userEmail = localStorage.getItem('userEmail');
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/feedback/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          ratings,
          feedback,
          submittedAt: new Date()
        })
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else if (response.status === 409) {
        setAlreadySubmitted(true);
      } else {
        alert('Failed to submit feedback. Please try again.');
      }
    } catch (error) {
      // console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    }
  };

  const handleClose = () => {
    setRatings({
      q1: 0, q2: 0, q3: 0, q4: 0, q5: 0,
      q6: 0, q7: 0, q8: 0, q9: 0, q10: 0
    });
    setFeedback('');
    setErrors({});
    setSubmitted(false);
    onClose();
  };

  if (!isOpen) return null;

  if (alreadySubmitted) {
    return (
      <div className="feedback-overlay" onClick={handleClose}>
        <div className="feedback-modal feedback-success" onClick={(e) => e.stopPropagation()}>
          <div className="success-content">
            <div className="success-icon">✓</div>
            <h2>Feedback Already Received</h2>
            <p>Thank you for your valuable feedback! You've already submitted your response.</p>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
              Your input helps us continuously improve the research platform.
            </p>
            <button onClick={handleClose} className="close-btn">Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="feedback-overlay" onClick={handleClose}>
        <div className="feedback-modal feedback-success" onClick={(e) => e.stopPropagation()}>
          <div className="success-content">
            <div className="success-icon">🎉</div>
            <h2>Feedback Submitted Successfully!</h2>
            <p>Thank you for taking the time to share your experience.</p>
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
              Your insights help us build a better research platform for everyone.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-overlay" onClick={handleClose}>
      <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="feedback-header">
          <h2>📝 Help Us Improve</h2>
          <button className="feedback-close" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="feedback-form">
          <div className="feedback-intro">
            <p>
              <strong>Your feedback drives our improvement!</strong> Please take 2-3 minutes to rate your 
              experience across all research phases. This helps us enhance the platform for researchers like you.
            </p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#666' }}>
              All questions are required • Rate from 1 (Poor) to 5 (Excellent)
            </p>
          </div>

          <div className="feedback-questions">
            {questions.map((question, index) => (
              <div key={question.id} className={`feedback-question ${errors[question.id] ? 'error' : ''}`}>
                <div className="question-number">{index + 1}</div>
                <div className="question-content">
                  <label className="question-text">{question.text}</label>
                  <p className="question-subtitle">{question.subtitle}</p>
                  
                  <div className="rating-options">
                    {[1, 2, 3, 4, 5].map(value => (
                      <label key={value} className={`rating-option ${ratings[question.id] === value ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name={question.id}
                          value={value}
                          checked={ratings[question.id] === value}
                          onChange={() => handleRatingChange(question.id, value)}
                        />
                        <span className="rating-circle">{value}</span>
                      </label>
                    ))}
                  </div>
                  {errors[question.id] && (
                    <span className="error-message">Please select a rating</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="feedback-textarea-section">
            <label className="textarea-label">
              💭 Additional Comments or Suggestions (Optional)
            </label>
            <textarea
              className="feedback-textarea"
              placeholder="Help us improve! Share your thoughts on what worked well, what needs improvement, feature suggestions, or any specific issues you encountered during your research journey..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={6}
            />
          </div>

          <div className="feedback-actions">
            <button type="button" className="btn-cancel" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              Submit Feedback
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal;
