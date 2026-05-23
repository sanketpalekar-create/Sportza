import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../components/figma/screens/LoginScreen';

/**
 * Full-screen login page (Figma dark theme).
 * Redirects to /app if already logged in; on success redirects to /app.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const { user, login, requestOtp, loginWithOtp, loginWithGoogle, loginWithFacebook } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const handleLogin = async (email, password) => {
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);
    if (result.success) navigate('/app', { replace: true });
    return result;
  };

  const handleSendOtp = async (payload) => {
    setIsLoading(true);
    const result = await requestOtp(payload);
    setIsLoading(false);
    return result;
  };

  const handleVerifyOtp = async (payload) => {
    setIsLoading(true);
    const result = await loginWithOtp(payload);
    setIsLoading(false);
    if (result.success) navigate('/app', { replace: true });
    return result;
  };

  const handleGoogle = async (idToken) => {
    const result = await loginWithGoogle(idToken);
    if (result.success) navigate('/app', { replace: true });
    return result;
  };

  const handleFacebook = async (accessToken) => {
    const result = await loginWithFacebook(accessToken);
    if (result.success) navigate('/app', { replace: true });
    return result;
  };

  return (
    <LoginScreen
      onLogin={handleLogin}
      onSendOtp={handleSendOtp}
      onVerifyOtp={handleVerifyOtp}
      onGoogle={handleGoogle}
      onFacebook={handleFacebook}
      isLoading={isLoading}
    />
  );
}
