import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import Modal from './Modal';
import './ChatPhase.css';

const ChatPhase = ({ chatId }) => {
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatSession, setActiveChatSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [renamingSession, setRenamingSession] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [typingMessage, setTypingMessage] = useState('');
  const messagesEndRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, conversationId: null });

  const loadChatSession = useCallback((conversationId) => {
    setActiveChatSession(conversationId);
    const session = chatSessions.find(s => s.conversationId === conversationId);
    if (session) {
      setMessages(session.messages || []);
    }
  }, [chatSessions]);

  const loadChatSessions = useCallback(() => {
    // Load chat sessions from localStorage
    const savedSessions = localStorage.getItem(`chat_sessions_${chatId}`);
    if (savedSessions) {
      const sessions = JSON.parse(savedSessions);
      setChatSessions(sessions);
      if (sessions.length > 0) {
        const firstConversationId = sessions[0].conversationId;
        setActiveChatSession(firstConversationId);
        const session = sessions.find(s => s.conversationId === firstConversationId);
        if (session) {
          setMessages(session.messages || []);
        }
      }
    }
  }, [chatId]);

  useEffect(() => {
    loadChatSessions();
  }, [loadChatSessions]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const typeMessage = (text, updatedMessages) => {
    const words = text.split(' ');
    let wordIndex = 0;
    setTypingMessage('');
    
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    typingIntervalRef.current = setInterval(() => {
      if (wordIndex < words.length) {
        setTypingMessage(prev => {
          if (prev === '') {
            return words[wordIndex];
          }
          return prev + ' ' + words[wordIndex];
        });
        wordIndex++;
      } else {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
        
        const botMessage = {
          role: 'assistant',
          content: text,
          timestamp: new Date().toISOString()
        };
        
        const finalMessages = [...updatedMessages, botMessage];
        setMessages(finalMessages);
        setTypingMessage('');
        setLoading(false);
        
        // Update session in localStorage
        const updatedSessions = chatSessions.map(session => {
          if (session.conversationId === activeChatSession) {
            return {
              ...session,
              messages: finalMessages,
              updatedAt: new Date().toISOString()
            };
          }
          return session;
        });
        saveChatSessions(updatedSessions);
      }
    }, 50);
  };

  const saveChatSessions = (sessions) => {
    localStorage.setItem(`chat_sessions_${chatId}`, JSON.stringify(sessions));
    setChatSessions(sessions);
  };

  const createNewChat = () => {
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSession = {
      conversationId,
      title: `Chat ${chatSessions.length + 1}`,
      createdAt: new Date().toISOString(),
      messages: []
    };

    const updatedSessions = [newSession, ...chatSessions];
    saveChatSessions(updatedSessions);
    setActiveChatSession(conversationId);
    setMessages([]);
  };



  const startRenameSession = (conversationId, currentTitle, e) => {
    e.stopPropagation();
    setRenamingSession(conversationId);
    setRenameValue(currentTitle);
  };

  const saveRename = (conversationId, e) => {
    e.stopPropagation();
    if (!renameValue.trim()) {
      setRenamingSession(null);
      return;
    }

    const updatedSessions = chatSessions.map(session =>
      session.conversationId === conversationId
        ? { ...session, title: renameValue.trim() }
        : session
    );
    saveChatSessions(updatedSessions);
    setRenamingSession(null);
    setRenameValue('');
  };

  const cancelRename = (e) => {
    e.stopPropagation();
    setRenamingSession(null);
    setRenameValue('');
  };

  const deleteChatSession = (conversationId, e) => {
    e.stopPropagation();
    setConfirmModal({ isOpen: true, conversationId });
  };

  const executeDeleteChat = () => {
    const conversationId = confirmModal.conversationId;
    setConfirmModal({ isOpen: false, conversationId: null });
    
    const updatedSessions = chatSessions.filter(s => s.conversationId !== conversationId);
    saveChatSessions(updatedSessions);
    
    if (activeChatSession === conversationId) {
      if (updatedSessions.length > 0) {
        loadChatSession(updatedSessions[0].conversationId);
      } else {
        setActiveChatSession(null);
        setMessages([]);
      }
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    if (!activeChatSession) {
      createNewChat();
      return;
    }

    const userMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setLoading(true);

    try {
      const chatbotWebhookUrl = process.env.REACT_APP_CHATBOT_WEBHOOK_URL || 'https://n8n.srv1162962.hstgr.cloud/webhook/researcher-chatbot';
      const response = await axios.post(chatbotWebhookUrl, {
        chatId: chatId,
        conversationId: activeChatSession,
        message: inputMessage,
        timestamp: new Date().toISOString()
      });

      // Extract output from array format: [{"output": "text"}]
      let botResponseText = 'I received your message.';
      if (Array.isArray(response.data) && response.data.length > 0 && response.data[0].output) {
        botResponseText = response.data[0].output;
      } else if (response.data.output) {
        botResponseText = response.data.output;
      } else if (response.data.response) {
        botResponseText = response.data.response;
      } else if (response.data.message) {
        botResponseText = response.data.message;
      }

      // Start typing animation
      typeMessage(botResponseText, updatedMessages);

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        error: true
      };
      setMessages([...updatedMessages, errorMessage]);
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleDownloadReport = async () => {
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
    <div className="chat-phase-container">
      {/* Chat Sessions Sidebar */}
      <div className="chat-sessions-sidebar">
        <div className="chat-sessions-header">
          <h3>💬 Chat Sessions</h3>
          <button className="new-chat-btn" onClick={createNewChat}>
            + New Chat
          </button>
        </div>
        
        <div className="download-report-sidebar">
          <button className="download-report-btn-sidebar" onClick={handleDownloadReport}>
            <span className="download-icon">📥</span>
            Download Report
          </button>
        </div>

        <div className="chat-sessions-list">
          {chatSessions.length === 0 ? (
            <p className="no-sessions">No chat sessions yet. Start a new chat!</p>
          ) : (
            chatSessions.map((session) => (
              <div
                key={session.conversationId}
                className={`chat-session-item ${activeChatSession === session.conversationId ? 'active' : ''}`}
                onClick={() => loadChatSession(session.conversationId)}
              >
                <div className="session-info">
                  {renamingSession === session.conversationId ? (
                    <div className="rename-input-container" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        className="rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(session.conversationId, e);
                          if (e.key === 'Escape') cancelRename(e);
                        }}
                        autoFocus
                      />
                      <div className="rename-buttons">
                        <button
                          className="save-rename-btn"
                          onClick={(e) => saveRename(session.conversationId, e)}
                          title="Save"
                        >
                          ✓
                        </button>
                        <button
                          className="cancel-rename-btn"
                          onClick={cancelRename}
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4>{session.title}</h4>
                      <p className="session-date">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </p>
                      <p className="session-preview">
                        {session.messages.length} messages
                      </p>
                    </>
                  )}
                </div>
                <div className="session-actions">
                  {renamingSession !== session.conversationId && (
                    <>
                      <button
                        className="rename-session-btn"
                        onClick={(e) => startRenameSession(session.conversationId, session.title, e)}
                        title="Rename chat"
                      >
                        ✏️
                      </button>
                      <button
                        className="delete-session-btn"
                        onClick={(e) => deleteChatSession(session.conversationId, e)}
                        title="Delete chat"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="chat-window">
        {!activeChatSession ? (
          <div className="chat-empty-state">
            <div className="empty-icon">💬</div>
            <h2>Research Chat Assistant</h2>
            <p>Ask questions about your research, request clarifications, or explore related topics.</p>
            <button className="start-chat-btn" onClick={createNewChat}>
              Start New Chat
            </button>
          </div>
        ) : (
          <>
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-welcome">
                  <h3>👋 Welcome to Research Chat!</h3>
                  <p>Ask me anything about your research findings.</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role} ${msg.error ? 'error' : ''}`}>
                    <div className="message-avatar">
                      {msg.role === 'user' ? '👤' : '🤖'}
                    </div>
                    <div className="message-content">
                      <div className="message-text">{msg.content}</div>
                      <div className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {loading && !typingMessage && (
                <div className="message assistant loading">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              {typingMessage && (
                <div className="message assistant typing">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="message-text">{typingMessage}</div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
              <textarea
                className="chat-input"
                placeholder="Ask a question about your research..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                rows={1}
                disabled={loading}
              />
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={!inputMessage.trim() || loading}
              >
                {loading ? '⏳' : '📤'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Confirm Delete Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, conversationId: null })}
        title="Delete Chat"
        message="Are you sure you want to delete this chat? This action cannot be undone."
        type="confirm"
        confirmText="Delete"
        cancelText="Cancel"
        showCancel={true}
        onConfirm={executeDeleteChat}
      />
    </div>
  );
};

export default ChatPhase;
