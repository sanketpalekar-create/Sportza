import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID;

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid var(--figma-border)',
  background: 'var(--figma-card)',
  color: '#fff',
  fontSize: 16,
  outline: 'none',
};
const labelStyle = { display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 8 };

export function LoginScreen({
  onLogin,
  onSendOtp,
  onVerifyOtp,
  onGoogle,
  onFacebook,
  isLoading = false,
  }) {
  const [mode, setMode] = useState('password');
  const [otpChannel, setOtpChannel] = useState('email');
  const [otpSent, setOtpSent] = useState(false);
  const [form, setForm] = useState({ email: '', phone: '', password: '', otp: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await onLogin(form.email, form.password);
    if (res && !res.success) setError(res.message || 'Login failed');
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (otpChannel === 'email' && !form.email) return;
    if (otpChannel === 'phone' && !form.phone) return;
    setError('');
    const payload = otpChannel === 'email' ? { email: form.email } : { phone: form.phone };
    const res = await onSendOtp(payload);
    if (res && !res.success) setError(res.message || 'Failed to send OTP');
    else if (res && res.success) setOtpSent(true);
  };

  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setError('');
    const payload = { otp: form.otp };
    if (otpChannel === 'email') payload.email = form.email;
    else payload.phone = form.phone;
    const res = await onVerifyOtp(payload);
    if (res && !res.success) setError(res.message || 'Invalid OTP');
  };

  const handleGoogleClick = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google sign-in is not configured.');
      return;
    }
    if (typeof window.google === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => initGoogle();
      document.head.appendChild(script);
    } else initGoogle();
    function initGoogle() {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (res) => {
          await onGoogle(res.credential);
        },
      });
      window.google.accounts.id.prompt();
    }
  }, [onGoogle]);

  const handleFacebookClick = useCallback(async () => {
    if (!FACEBOOK_APP_ID) {
      setError('Facebook sign-in is not configured.');
      return;
    }
    if (typeof window.FB === 'undefined') {
      window.fbAsyncInit = function () {
        window.FB.init({ appId: FACEBOOK_APP_ID, cookie: true, xfbml: true, version: 'v18.0' });
        runFbLogin();
      };
      const s = document.createElement('script');
      s.src = 'https://connect.facebook.net/en_US/sdk.js';
      s.async = true;
      document.head.appendChild(s);
    } else runFbLogin();
    function runFbLogin() {
      window.FB.login(
        async (response) => {
          if (response.authResponse && response.authResponse.accessToken) {
            await onFacebook(response.authResponse.accessToken);
          }
        },
        { scope: 'email,public_profile' }
      );
    }
  }, [onFacebook]);

  return (
    <div className="figma-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="figma-app-inner" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/logo.png" alt="Sportza" style={{ width: 56, height: 56, margin: '0 auto 16px', display: 'block', objectFit: 'contain', objectPosition: '51% 52%' }} />
            <h1 className="figma-heading1" style={{ marginBottom: 8 }}>Welcome back</h1>
            <p className="figma-body">Sign in to book courts and join games</p>
          </div>

          <div className="figma-card" style={{ padding: 24, marginBottom: 16 }}>
            {(GOOGLE_CLIENT_ID || FACEBOOK_APP_ID) && (
              <>
                {GOOGLE_CLIENT_ID && (
                  <button type="button" onClick={handleGoogleClick} disabled={isLoading} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--figma-border)', background: 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Continue with Google
                  </button>
                )}
                {FACEBOOK_APP_ID && (
                  <button type="button" onClick={handleFacebookClick} disabled={isLoading} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#1877F2', color: '#fff', fontSize: 14, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Continue with Facebook
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--figma-border)' }} />
                  <span style={{ color: '#64748B', fontSize: 13 }}>or</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--figma-border)' }} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button type="button" onClick={() => { setMode('password'); setOtpSent(false); setError(''); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: mode === 'password' ? '2px solid var(--figma-primary)' : '1px solid var(--figma-border)', background: mode === 'password' ? 'rgba(59,130,246,0.15)' : 'transparent', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Password</button>
              <button type="button" onClick={() => { setMode('otp'); setOtpSent(false); setError(''); }} style={{ flex: 1, padding: 10, borderRadius: 10, border: mode === 'otp' ? '2px solid var(--figma-primary)' : '1px solid var(--figma-border)', background: mode === 'otp' ? 'rgba(59,130,246,0.15)' : 'transparent', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>OTP</button>
            </div>

            {error && <div style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            {mode === 'password' && (
              <form onSubmit={handlePasswordSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                    <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@example.com" style={{ ...inputStyle, paddingLeft: 44 }} />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                    <input type="password" name="password" value={form.password} onChange={handleChange} required placeholder="••••••••" style={{ ...inputStyle, paddingLeft: 44 }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginBottom: 20 }}>
                  <Link to="/forgot-password" style={{ color: 'var(--figma-primary)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>Forgot password?</Link>
                </div>
                <button type="submit" className="figma-btn-primary" style={{ width: '100%' }} disabled={isLoading}>
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            )}

            {mode === 'otp' && !otpSent && (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button type="button" onClick={() => setOtpChannel('email')} style={{ flex: 1, padding: 8, borderRadius: 8, border: otpChannel === 'email' ? '2px solid var(--figma-primary)' : '1px solid var(--figma-border)', background: otpChannel === 'email' ? 'rgba(59,130,246,0.15)' : 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Email</button>
                  <button type="button" onClick={() => setOtpChannel('phone')} style={{ flex: 1, padding: 8, borderRadius: 8, border: otpChannel === 'phone' ? '2px solid var(--figma-primary)' : '1px solid var(--figma-border)', background: otpChannel === 'phone' ? 'rgba(59,130,246,0.15)' : 'transparent', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Phone</button>
                </div>
                <form onSubmit={handleSendOtp}>
                  {otpChannel === 'email' ? (
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}>Email</label>
                      <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@example.com" style={inputStyle} />
                    </div>
                  ) : (
                    <div style={{ marginBottom: 16 }}>
                      <label style={labelStyle}>Phone</label>
                      <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" style={inputStyle} />
                    </div>
                  )}
                  <button type="submit" className="figma-btn-primary" style={{ width: '100%' }} disabled={isLoading}>Send OTP</button>
                </form>
              </>
            )}

            {mode === 'otp' && otpSent && (
              <form onSubmit={handleOtpVerify}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>{otpChannel === 'email' ? 'Email' : 'Phone'}</label>
                  <input type={otpChannel === 'email' ? 'email' : 'tel'} name={otpChannel === 'email' ? 'email' : 'phone'} value={otpChannel === 'email' ? form.email : form.phone} readOnly style={{ ...inputStyle, opacity: 0.8 }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Enter 6-digit OTP</label>
                  <input type="text" name="otp" value={form.otp} onChange={handleChange} placeholder="000000" maxLength={6} required style={inputStyle} />
                </div>
                <button type="submit" className="figma-btn-primary" style={{ width: '100%' }} disabled={isLoading}>Verify & sign in</button>
                <button type="button" onClick={() => setOtpSent(false)} style={{ width: '100%', marginTop: 12, padding: 10, background: 'none', border: 'none', color: '#94A3B8', fontSize: 13, cursor: 'pointer' }}>Change {otpChannel === 'email' ? 'email' : 'phone'}</button>
              </form>
            )}
          </div>

          <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
            Don&apos;t have an account?{' '}
            <Link to="/register" style={{ color: 'var(--figma-primary)', fontWeight: 600, textDecoration: 'none' }}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
