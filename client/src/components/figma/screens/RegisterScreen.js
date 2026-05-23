import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, User, Phone } from 'lucide-react';

const CITIES = ['Pune', 'Mumbai', 'Bangalore', 'Delhi', 'Hyderabad', 'Chennai'];

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

export function RegisterScreen({ onRegister, isLoading = false }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    city: 'Pune',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      ...(form.phone.trim() && { phone: form.phone.trim() }),
      ...(form.city && { city: form.city, location: { city: form.city } }),
    };
    const res = await onRegister(payload);
    if (res && !res.success) setError(res.message || 'Registration failed');
  };

  return (
    <div className="figma-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="figma-app-inner" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img src="/logo.png" alt="Sportza" style={{ width: 56, height: 56, margin: '0 auto 16px', display: 'block', objectFit: 'contain', objectPosition: '51% 52%' }} />
            <h1 className="figma-heading1" style={{ marginBottom: 8 }}>Create account</h1>
            <p className="figma-body">A few details to get you started</p>
          </div>

          <form onSubmit={handleSubmit} className="figma-card" style={{ padding: 24, marginBottom: 16 }}>
            {error && <div style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Name</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder="Your name" style={{ ...inputStyle, paddingLeft: 44 }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="you@example.com" style={{ ...inputStyle, paddingLeft: 44 }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Phone <span style={{ color: '#64748B', fontWeight: 400 }}>(optional)</span></label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" style={{ ...inputStyle, paddingLeft: 44 }} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>City <span style={{ color: '#64748B', fontWeight: 400 }}>(optional)</span></label>
              <select name="city" value={form.city} onChange={handleChange} style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394A3B8\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36 }}>
                {CITIES.map((c) => <option key={c} value={c} style={{ background: 'var(--figma-card)', color: '#fff' }}>{c}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={6} placeholder="At least 6 characters" style={{ ...inputStyle, paddingLeft: 44 }} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Confirm password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required minLength={6} placeholder="Repeat password" style={{ ...inputStyle, paddingLeft: 44 }} />
              </div>
            </div>

            <button type="submit" className="figma-btn-primary" style={{ width: '100%' }} disabled={isLoading}>
              {isLoading ? 'Creating account…' : 'Sign up'}
            </button>
          </form>

          <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--figma-primary)', fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
