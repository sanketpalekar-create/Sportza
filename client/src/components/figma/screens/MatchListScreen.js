import React, { useState } from 'react';
import { ChevronLeft, Calendar, MapPin, Play, Eye } from 'lucide-react';

const MOCK_MATCHES = [
  { id: '1', sport: 'Badminton', venue: 'Elite Sports Arena', location: 'Koregaon Park', date: 'Today', time: '6:00 PM', team1: { name: 'Team A' }, team2: { name: 'Team B' }, status: 'scheduled', scoreType: 'simple' },
  { id: '2', sport: 'Cricket', venue: 'Victory Cricket Ground', location: 'Wakad', date: 'Tomorrow', time: '9:00 AM', team1: { name: 'Reds' }, team2: { name: 'Blues' }, status: 'scheduled', scoreType: 'cricket' },
  { id: '3', sport: 'Tennis', venue: 'Phoenix Tennis Club', location: 'Baner', date: 'Feb 18', time: '4:00 PM', team1: { name: 'You' }, team2: { name: 'Opponent' }, status: 'in_progress', scoreType: 'tennis', scores: { sets: [{ team1: 6, team2: 4 }], games: { team1: 3, team2: 2 }, points: { team1: 0, team2: 0 }, serving: 'team1' } },
  { id: '4', sport: 'Football', venue: 'Champions Football Arena', location: 'Hinjewadi', date: 'Feb 15', time: '5:00 PM', team1: { name: 'Team A' }, team2: { name: 'Team B' }, status: 'completed', scoreType: 'simple', scores: { team1: 3, team2: 2 } },
];

export function MatchListScreen({ onBack, onSelectMatch }) {
  const [filter, setFilter] = useState('all');
  const list = filter === 'all' ? MOCK_MATCHES : MOCK_MATCHES.filter((m) => m.status === filter);

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>My matches</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'scheduled', label: 'Upcoming' },
          { key: 'in_progress', label: 'Live' },
          { key: 'completed', label: 'Completed' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: filter === key ? 'var(--figma-primary)' : 'var(--figma-card)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="figma-space-y-4">
        {list.map((m) => (
          <div key={m.id} className="figma-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 12, fontWeight: 500 }}>{m.sport}</span>
              {m.status === 'in_progress' && <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.2)', color: '#22C55E', fontSize: 11, fontWeight: 600 }}>LIVE</span>}
              {m.status === 'completed' && <span style={{ color: '#94A3B8', fontSize: 12 }}>Completed</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{m.team1?.name || 'Team 1'}</span>
              {m.scores && m.scoreType === 'simple' && <span style={{ color: '#94A3B8', fontSize: 14 }}>{m.scores.team1} – {m.scores.team2}</span>}
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{m.team2?.name || 'Team 2'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>
              <MapPin size={12} /> {m.venue}
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {m.date} · {m.time}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(m.status === 'scheduled' || m.status === 'in_progress') && (
                <button type="button" className="figma-btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => onSelectMatch && onSelectMatch(m)}>
                  {m.status === 'scheduled' ? <><Play size={16} /> Start</> : <><Eye size={16} /> View score</>}
                </button>
              )}
              {m.status === 'completed' && (
                <button type="button" className="figma-btn-ghost" style={{ flex: 1 }} onClick={() => onSelectMatch && onSelectMatch(m)}>View result</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {list.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8', fontSize: 14 }}>No matches in this category.</div>
      )}
    </div>
  );
}
