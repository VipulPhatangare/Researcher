import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const verifyToken = async (email) => {
    const response = await axios.post(`${API_URL}/auth/verify-token`, { email });
    setUser(response.data.user);
    // Update stored user data
    localStorage.setItem('userData', JSON.stringify(response.data.user));
    return response.data.user;
  };

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const email = localStorage.getItem('userEmail');
      const storedUserData = localStorage.getItem('userData');
      
      // console.log('🔍 Checking auth on mount:', { email, hasUserData: !!storedUserData });
      
      if (email && storedUserData) {
        try {
          // Parse and set user from localStorage
          const userData = JSON.parse(storedUserData);
          // console.log('✅ Setting user from localStorage:', userData);
          setUser(userData);
          
          // Verify user still exists in background
          try {
            await verifyToken(email);
            // console.log('✅ User verified successfully');
          } catch (error) {
            // console.log('❌ Verification failed:', error);
            // If verification fails, clear everything
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userData');
            setUser(null);
          }
        } catch (error) {
          // console.error('❌ Error parsing user data:', error);
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userData');
          setUser(null);
        }
      } else {
        // console.log('❌ No stored auth data found');
      }
      
      setLoading(false);
      // console.log('✅ Auth loading complete');
    };
    
    initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    const { user: userData } = response.data;
    
    // console.log('✅ Login successful:', userData);
    
    // Store user data and email in localStorage
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userData', JSON.stringify(userData));
    
    // console.log('✅ Saved to localStorage:', { email, userData });
    
    setUser(userData);
    return response.data;
  };

  const signup = async (firstName, surname, email, password) => {
    const response = await axios.post(`${API_URL}/auth/signup`, {
      firstName,
      surname,
      email,
      password
    });
    const { user: userData } = response.data;
    
    // Store user data and email in localStorage
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userData', JSON.stringify(userData));
    
    setUser(userData);
    return response.data;
  };

  const forgotPassword = async (email) => {
    const response = await axios.post(`${API_URL}/auth/forgot-password`, { email });
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userData');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    signup,
    forgotPassword,
    logout,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
