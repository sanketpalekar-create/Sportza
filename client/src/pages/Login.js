import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID;

const Login = () => {
  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [otpChannel, setOtpChannel] = useState('email'); // 'email' | 'phone'
  const [formData, setFormData] = useState({ email: '', phone: '', password: '', otp: '' });
  const [otpSent, setOtpSent] = useState(false);
  const { login, loginWithGoogle, loginWithFacebook, requestOtp, loginWithOtp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const result = await login(formData.email, formData.password);
    if (result.success) navigate('/venues');
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (otpChannel === 'email' && !formData.email) return;
    if (otpChannel === 'phone' && !formData.phone) return;
    const payload = otpChannel === 'email' ? { email: formData.email } : { phone: formData.phone };
    const result = await requestOtp(payload);
    if (result.success) setOtpSent(true);
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    const payload = { otp: formData.otp };
    if (otpChannel === 'email') payload.email = formData.email;
    else payload.phone = formData.phone;
    const result = await loginWithOtp(payload);
    if (result.success) navigate('/venues');
  };

  const handleGoogleClick = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      alert('Google sign-in is not configured. Set REACT_APP_GOOGLE_CLIENT_ID.');
      return;
    }
    if (typeof window.google === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => initGoogle();
      document.head.appendChild(script);
    } else {
      initGoogle();
    }
    function initGoogle() {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (res) => {
          const result = await loginWithGoogle(res.credential);
          if (result.success) navigate('/venues');
        }
      });
      window.google.accounts.id.prompt();
    }
  }, [loginWithGoogle, navigate]);

  const handleFacebookClick = useCallback(async () => {
    if (!FACEBOOK_APP_ID) {
      alert('Facebook sign-in is not configured. Set REACT_APP_FACEBOOK_APP_ID.');
      return;
    }
    if (typeof window.FB === 'undefined') {
      window.fbAsyncInit = function () {
        window.FB.init({ appId: FACEBOOK_APP_ID, cookie: true, xfbml: true, version: 'v18.0' });
        window.FB.Event.subscribe('auth.statusChange', () => {});
        runFbLogin();
      };
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      document.head.appendChild(script);
    } else {
      runFbLogin();
    }
    function runFbLogin() {
      window.FB.login(
        async (response) => {
          if (response.authResponse && response.authResponse.accessToken) {
            const result = await loginWithFacebook(response.authResponse.accessToken);
            if (result.success) navigate('/venues');
          }
        },
        { scope: 'email,public_profile' }
      );
    }
  }, [loginWithFacebook, navigate]);

  return (
    <div className="auth-container">
      <div className="auth-card auth-card-wide">
        <img src="/logo.png" alt="Sportza" className="auth-logo" />
        <h2>Login</h2>

        <div className="auth-oauth">
          {GOOGLE_CLIENT_ID && (
            <button type="button" className="btn-oauth btn-google" onClick={handleGoogleClick}>
              Continue with Google
            </button>
          )}
          {FACEBOOK_APP_ID && (
            <button type="button" className="btn-oauth btn-facebook" onClick={handleFacebookClick}>
              Continue with Facebook
            </button>
          )}
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="auth-tabs">
          <button type="button" className={mode === 'password' ? 'active' : ''} onClick={() => setMode('password')}>Password</button>
          <button type="button" className={mode === 'otp' ? 'active' : ''} onClick={() => setMode('otp')}>OTP</button>
        </div>

        {mode === 'password' && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} required />
            </div>
            <button type="submit" className="btn-submit">Login</button>
          </form>
        )}

        {mode === 'otp' && (
          <>
            {!otpSent ? (
              <>
                <div className="auth-tabs auth-tabs-small">
                  <button type="button" className={otpChannel === 'email' ? 'active' : ''} onClick={() => setOtpChannel('email')}>Email</button>
                  <button type="button" className={otpChannel === 'phone' ? 'active' : ''} onClick={() => setOtpChannel('phone')}>Phone</button>
                </div>
                <form onSubmit={handleSendOtp}>
                  {otpChannel === 'email' ? (
                    <div className="form-group">
                      <label>Email</label>
                      <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Phone number (with country code)</label>
                      <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="e.g. 919876543210" required />
                    </div>
                  )}
                  <button type="submit" className="btn-submit">Send OTP</button>
                </form>
              </>
            ) : (
              <form onSubmit={handleOtpVerify}>
                <div className="form-group">
                  <label>{otpChannel === 'email' ? 'Email' : 'Phone'}</label>
                  <input
                    type={otpChannel === 'email' ? 'email' : 'tel'}
                    name={otpChannel === 'email' ? 'email' : 'phone'}
                    value={otpChannel === 'email' ? formData.email : formData.phone}
                    onChange={handleChange}
                    readOnly
                  />
                </div>
                <div className="form-group">
                  <label>Enter 6-digit OTP</label>
                  <input type="text" name="otp" value={formData.otp} onChange={handleChange} placeholder="000000" maxLength={6} required />
                </div>
                <button type="submit" className="btn-submit">Verify & Login</button>
                <button type="button" className="btn-link" onClick={() => setOtpSent(false)}>Change {otpChannel === 'email' ? 'email' : 'phone'}</button>
              </form>
            )}
          </>
        )}

        <p className="auth-link">
          Don't have an account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
