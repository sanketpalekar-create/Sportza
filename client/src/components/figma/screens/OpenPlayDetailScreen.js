import React from 'react';
import { ChevronLeft, MapPin, Calendar, Clock, User } from 'lucide-react';

export function OpenPlayDetailScreen({ session, onBack, onJoin, onLeave, onViewPlayers }) {
  const raw = session || {};
  const s = {
    id: raw.id || '1',
    title: raw.title || raw.venue || 'Open Play',
    sport: raw.sport || 'Badminton',
    host: raw.host || 'Host',
    location: raw.location || 'Venue',
    date: raw.date || 'Today',
    time: raw.time || '6:00 PM',
    price: raw.price || 'Free',
    players: typeof raw.players === 'object' ? raw.players?.current : raw.players,
    maxPlayers: typeof raw.players === 'object' ? raw.players?.max : raw.maxPlayers,
  };
  const playersCount = s.players ?? 0;
  const maxCount = s.maxPlayers ?? 8;

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Open Play</span>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{s.title}</h2>
        <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 12 }}>{s.sport}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>
          <User size={14} /> Hosted by {s.host}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>
          <MapPin size={14} /> {s.location}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>
          <Calendar size={14} /> {s.date} · <Clock size={14} /> {s.time}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ color: '#fff', fontSize: 14 }}>{playersCount}/{maxCount} players</span>
          <span style={{ color: '#22C55E', fontSize: 14, fontWeight: 600 }}>{s.price}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="figma-btn-ghost" onClick={() => onViewPlayers && onViewPlayers()}>View Players</button>
        <button className="figma-btn-primary" style={{ width: '100%' }} onClick={() => onJoin && onJoin()}>Join Session</button>
        <button className="figma-btn-ghost" style={{ color: '#EF4444' }} onClick={() => onLeave && onLeave()}>Leave Session</button>
      </div>
    </div>
  );
}
