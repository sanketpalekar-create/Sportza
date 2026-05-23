import React, { useState } from 'react';
import { MapPin, Clock, Users, UserPlus, Search, Calendar } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

const SPORT_FILTERS = ['All Sports', 'Football', 'Basketball', 'Badminton', 'Cricket'];

const DISCOVER_SESSIONS = [
  { id: 1, sport: 'Football', venue: 'Champions Football Arena', location: 'Hinjewadi', image: 'https://images.unsplash.com/photo-1603508434829-7c4282d74483?w=400&q=80', time: 'Today, 5:00 PM', duration: '90 mins', players: { current: 8, max: 12 }, level: 'Intermediate', host: 'Rahul M.', price: 'Free' },
  { id: 2, sport: 'Basketball', venue: 'Hoops Basketball Court', location: 'Viman Nagar', image: 'https://images.unsplash.com/photo-1710378844976-93a6538671ef?w=400&q=80', time: 'Tomorrow, 7:00 AM', duration: '60 mins', players: { current: 6, max: 10 }, level: 'Beginner', host: 'Priya S.', price: 'Free' },
  { id: 3, sport: 'Badminton', venue: 'Elite Sports Arena', location: 'Koregaon Park', image: 'https://images.unsplash.com/photo-1624024834874-2a1611305604?w=400&q=80', time: 'Today, 6:00 PM', duration: '60 mins', players: { current: 4, max: 8 }, level: 'All levels', host: 'Arjun P.', price: 'Free' },
];

const MY_OPEN_PLAYS = [
  { id: 10, sport: 'Badminton', venue: 'Elite Sports Arena', location: 'Koregaon Park', time: 'Feb 20, 6:00 PM', players: { current: 5, max: 8 }, level: 'Intermediate', host: 'You', isHost: true },
  { id: 11, sport: 'Football', venue: 'Champions Football Arena', location: 'Hinjewadi', time: 'Feb 22, 5:00 PM', players: { current: 10, max: 12 }, level: 'All levels', host: 'Rahul M.', isHost: false },
];

function getLevel(level) {
  if (level === 'Beginner') return { text: '#22C55E', bg: 'rgba(34,197,94,0.15)' };
  if (level === 'Intermediate') return { text: '#3B82F6', bg: 'rgba(59,130,246,0.15)' };
  if (level === 'All levels') return { text: '#94A3B8', bg: 'rgba(148,163,184,0.15)' };
  return { text: '#94A3B8', bg: 'rgba(148,163,184,0.15)' };
}

export function OpenPlayTab({ onSelectSession, onHostSession, onManageSession }) {
  const [sportFilter, setSportFilter] = useState('All Sports');
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('discover');

  const filteredDiscover = DISCOVER_SESSIONS.filter((s) => {
    if (sportFilter !== 'All Sports' && s.sport !== sportFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!s.venue.toLowerCase().includes(q) && !s.sport.toLowerCase().includes(q) && !s.location.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Open Play</h1>
          <p className="figma-body">Join pickup games or host your own</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onHostSession && onHostSession()}
        style={{ width: '100%', background: '#3B82F6', borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', cursor: 'pointer', marginBottom: '1.5rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserPlus size={20} color="#fff" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Host a Session</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 2 }}>Create your own game</div>
          </div>
        </div>
        <UserPlus size={24} color="#fff" />
      </button>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setActiveSection('discover')}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            background: activeSection === 'discover' ? 'var(--figma-primary)' : 'var(--figma-card)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Discover
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('my')}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            background: activeSection === 'my' ? 'var(--figma-primary)' : 'var(--figma-card)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          My Open Plays
        </button>
      </div>

      {activeSection === 'discover' && (
        <>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
            <input
              type="text"
              placeholder="Search by venue, sport, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 12px 12px 40px',
                borderRadius: 12,
                border: '1px solid var(--figma-border)',
                background: 'var(--figma-card)',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: 4 }}>
            {SPORT_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSportFilter(s)}
                style={{
                  flexShrink: 0,
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  background: sportFilter === s ? '#3B82F6' : 'var(--figma-card)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {s}
              </button>
            ))}
          </div>

          <h2 className="figma-heading2" style={{ marginBottom: 12 }}>Join pickup games</h2>
          <div className="figma-space-y-4">
            {filteredDiscover.map((s) => {
              const l = getLevel(s.level);
              return (
                <div key={s.id} className="figma-card" style={{ overflow: 'hidden' }}>
                  <div style={{ height: 140, position: 'relative' }}>
                    <ImageWithFallback src={s.image} alt={s.venue} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: 12, left: 12, padding: '4px 12px', borderRadius: 999, background: 'rgba(59,130,246,0.15)' }}>
                      <span style={{ color: '#3B82F6', fontSize: 12, fontWeight: 500 }}>{s.sport}</span>
                    </div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{s.venue}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 14, marginBottom: 12 }}>
                      <MapPin size={14} /> <span>{s.location}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, color: '#94A3B8', fontSize: 14 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={16} /> {s.time}</span>
                      <span>{s.duration}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, color: '#94A3B8', fontSize: 14 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={16} /> {s.players.current}/{s.players.max} players</span>
                      <span style={{ padding: '4px 10px', borderRadius: 999, background: l.bg, color: l.text, fontSize: 12, fontWeight: 500 }}>{s.level}</span>
                    </div>
                    <div className="figma-divider" style={{ paddingTop: 12, paddingBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 14 }}>Hosted by {s.host}</span>
                      <span style={{ color: '#22C55E', fontSize: 14, fontWeight: 600 }}>{s.price}</span>
                    </div>
                    <button type="button" className="figma-btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => onSelectSession && onSelectSession(s)}>
                      <UserPlus size={18} /> Join Session
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {filteredDiscover.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 14 }}>No sessions match your search. Try another filter.</div>
          )}
        </>
      )}

      {activeSection === 'my' && (
        <div style={{ marginTop: 8 }}>
          <h2 className="figma-heading2" style={{ marginBottom: 16 }}>Your sessions</h2>
          <div className="figma-space-y-4">
            {MY_OPEN_PLAYS.map((op) => {
              const [datePart, timePart] = (op.time || '').split(', ');
              const sessionForDetail = { id: op.id, title: op.venue, sport: op.sport, host: op.host, location: op.location, date: datePart || op.time, time: timePart || op.time, players: op.players?.current ?? 0, maxPlayers: op.players?.max ?? 8, price: 'Free' };
              return (
              <div key={op.id} className="figma-card" style={{ padding: 16 }} onClick={() => onSelectSession && onSelectSession(sessionForDetail)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelectSession && onSelectSession(sessionForDetail)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{op.venue}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 11, fontWeight: 500 }}>{op.sport}</span>
                      {op.isHost && <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 11, fontWeight: 500 }}>Host</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 13 }}>
                      <MapPin size={12} /> {op.location}
                    </div>
                  </div>
                  <span style={{ color: '#22C55E', fontSize: 13, fontWeight: 600 }}>Free</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94A3B8', fontSize: 13, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={14} /> {op.time}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={14} /> {op.players?.current ?? 0}/{op.players?.max ?? 8}</span>
                  {op.level && (() => { const l = getLevel(op.level); return <span style={{ padding: '3px 8px', borderRadius: 999, background: l.bg, color: l.text, fontSize: 11, fontWeight: 500 }}>{op.level}</span>; })()}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button type="button" className="figma-btn-ghost" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); onManageSession && onManageSession(sessionForDetail); }}>Manage</button>
                  <button type="button" className="figma-btn-primary" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); onSelectSession && onSelectSession(sessionForDetail); }}>View</button>
                </div>
              </div>
              );
            })}
          </div>
          {MY_OPEN_PLAYS.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 14 }}>You haven&apos;t joined or hosted any sessions yet. Discover games above or host one.</div>
          )}
        </div>
      )}
    </div>
  );
}
