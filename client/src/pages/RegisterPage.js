import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RegisterScreen } from '../components/figma/screens/RegisterScreen';

/**
 * Full-screen register page (Figma dark theme).
 * Minimal fields: name, email, phone (optional), city (optional), password, confirm.
 * Redirects to /app if already logged in; on success redirects to /app.
 */
export default function RegisterPage() {
  const navigate = useNavigate();
  const { user, register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const handleRegister = async (payload) => {
    setIsLoading(true);
    const result = await register(payload);
    setIsLoading(false);
    if (result.success) navigate('/app', { replace: true });
    return result;
  };

  return (
    <RegisterScreen
      onRegister={handleRegister}
      isLoading={isLoading}
    />
  );
}
