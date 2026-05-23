import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Login successful!');
      return { success: true };
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
      return { success: false };
    }
  };

  const loginWithGoogle = async (idToken) => {
    try {
      const response = await axios.post(`${API_URL}/auth/google`, { idToken });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Signed in with Google');
      return { success: true };
    } catch (error) {
      toast.error(error.response?.data?.message || 'Google sign-in failed');
      return { success: false };
    }
  };

  const loginWithFacebook = async (accessToken) => {
    try {
      const response = await axios.post(`${API_URL}/auth/facebook`, { accessToken });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Signed in with Facebook');
      return { success: true };
    } catch (error) {
      toast.error(error.response?.data?.message || 'Facebook sign-in failed');
      return { success: false };
    }
  };

  const requestOtp = async (payload) => {
    try {
      if (payload.email) {
        await axios.post(`${API_URL}/auth/otp/request`, { email: payload.email });
        toast.success('OTP sent to your email');
      } else if (payload.phone) {
        await axios.post(`${API_URL}/auth/otp/request`, { phone: payload.phone });
        toast.success('OTP sent to your phone');
      } else {
        toast.error('Email or phone required');
        return { success: false };
      }
      return { success: true };
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP');
      return { success: false };
    }
  };

  const loginWithOtp = async (payload) => {
    try {
      const body = { otp: payload.otp };
      if (payload.email) body.email = payload.email;
      else if (payload.phone) body.phone = payload.phone;
      const response = await axios.post(`${API_URL}/auth/otp/verify`, body);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Signed in successfully');
      return { success: true };
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid or expired OTP');
      return { success: false };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, userData);
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      toast.success('Registration successful!');
      return { success: true };
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
      return { success: false };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    toast.info('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      loginWithGoogle,
      loginWithFacebook,
      requestOtp,
      loginWithOtp
    }}>
      {children}
    </AuthContext.Provider>
  );
};
