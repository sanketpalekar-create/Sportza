import React, { useState } from 'react';
import { Activity, Plus, Play, Eye, Clock, CheckCircle } from 'lucide-react';

const SPORT_ICONS = {
  Badminton: '🏸',
  Tennis: '🎾',
  Cricket: '🏏',
  Football: '⚽',
  Basketball: '🏀',
  Squash: '🎱',
  Pickleball: '🏓',
  Other: '🏅',
};

const SPORTS = ['Badminton', 'Tennis', 'Cricket', 'Football', 'Basketball', 'Squash', 'Pickleball'];

const MOCK_MATCHES = [
  {
    id: '1',
    sport: 'Badminton',
    venue: 'Elite Sports Arena',
    date: 'Today',
    time: '6:00 PM',
    team1: { name: 'Team A' },
    team2: { name: 'Team B' },
    status: 'in_progress',
    scores: { sets: [{ team1: 21, team2: 18 }], points: { team1: 14, team2: 9 }, serving: 'team1' },
  },
  {
    id: '2',
    sport: 'Cricket',
    venue: 'Victory Cricket Ground',
    date: 'Today',
    time: '9:00 AM',
    team1: { name: 'Reds' },
    team2: { name: 'Blues' },
    status: 'scheduled',
    scores: null,
  },
  {
    id: '3',
    sport: 'Tennis',
    venue: 'Phoenix Tennis Club',
    date: 'Tomorrow',
    time: '4:00 PM',
    team1: { name: 'You' },
    team2: { name: 'Opponent' },
    status: 'scheduled',
    scores: null,
  },
  {
    id: '4',
    sport: 'Football',
    venue: 'Champions Football Arena',
    date: 'Yesterday',
    time: '5:00 PM',
    team1: { name: 'Team Alpha' },
    team2: { name: 'Team Beta' },
    status: 'completed',
    scores: { team1: 3, team2: 2 },
  },
];

function NewMatchModal({ onClose, onStart }) {
  const [sport, setSport] = useState('Badminton');
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');

  const handleStart = () => {
    if (!team1.trim() || !team2.trim()) return;
    onStart({
      id: Date.now().toString(),
      sport,
      venue: 'My Court',
      date: 'Today',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      team1: { name: team1.trim() },
      team2: { name: team2.trim() },
      status: 'scheduled',
      scores: null,
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--figma-bg, #111827)',
          borderRadius: '24px 24px 0 0',
          padding: 24,
          width: '100%',
          maxWidth: 420,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Start New Match</h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 20, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Sport
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SPORTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSport(s)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: sport === s ? '2px solid #3B82F6' : '2px solid transparent',
                  background: sport === s ? 'rgba(59,130,246,0.15)' : 'var(--figma-card, #1E293B)',
                  color: sport === s ? '#3B82F6' : '#94A3B8',
                  fontSize: 13,
                  fontWeight: sport === s ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {SPORT_ICONS[s]} {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#94A3B8', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Team / Player Names
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              placeholder="Team 1 / Player 1 name"
              value={team1}
              onChange={(e) => setTeam1(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'var(--figma-card, #1E293B)',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <input
              type="text"
              placeholder="Team 2 / Player 2 name"
              value={team2}
              onChange={(e) => setTeam2(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'var(--figma-card, #1E293B)',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <button
          type="button"
          className="figma-btn-primary"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 15,
            fontWeight: 600,
            opacity: team1.trim() && team2.trim() ? 1 : 0.5,
          }}
          onClick={handleStart}
          disabled={!team1.trim() || !team2.trim()}
        >
          <Play size={18} /> Start Scoring
        </button>
      </div>
    </div>
  );
}

function getStatusBadge(status) {
  if (status === 'in_progress') {
    return (
      <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.2)', color: '#22C55E', fontSize: 11, fontWeight: 700 }}>
        ● LIVE
      </span>
    );
  }
  if (status === 'scheduled') {
    return (
      <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 11, fontWeight: 600 }}>
        Upcoming
      </span>
    );
  }
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(100,116,139,0.2)', color: '#94A3B8', fontSize: 11, fontWeight: 600 }}>
      Done
    </span>
  );
}

function getScoreSummary(match) {
  if (!match.scores) return null;
  const { sport, scores } = match;
  if (sport === 'Cricket' && scores.innings1) {
    return `${scores.innings1.runs}/${scores.innings1.wickets}`;
  }
  if ((sport === 'Badminton' || sport === 'Tennis') && scores.points) {
    return `${scores.points.team1} – ${scores.points.team2}`;
  }
  if (typeof scores.team1 === 'number') {
    return `${scores.team1} – ${scores.team2}`;
  }
  return null;
}

export function ScoreMatchTab({ onSelectMatch }) {
  const [filter, setFilter] = useState('all');
  const [showNewModal, setShowNewModal] = useState(false);
  const [matches, setMatches] = useState(MOCK_MATCHES);

  const filtered = filter === 'all' ? matches : matches.filter((m) => m.status === filter);
  const liveCount = matches.filter((m) => m.status === 'in_progress').length;

  const handleStartNew = (newMatch) => {
    setShowNewModal(false);
    setMatches((prev) => [newMatch, ...prev]);
    onSelectMatch && onSelectMatch(newMatch);
  };

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      {showNewModal && (
        <NewMatchModal
          onClose={() => setShowNewModal(false)}
          onStart={handleStartNew}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Score a Match</h1>
          <p className="figma-body">Track live scores for any sport</p>
        </div>
        {liveCount > 0 && (
          <span style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 12, fontWeight: 700 }}>
            {liveCount} Live
          </span>
        )}
      </div>

      {/* Hero CTA */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1a1040 0%, #0f172a 50%, #162032 100%)',
          borderRadius: 20,
          padding: '20px 20px 16px',
          marginBottom: 20,
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(59,130,246,0.15)',
        }}
      >
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(59,130,246,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 20, width: 70, height: 70, borderRadius: '50%', background: 'rgba(34,197,94,0.06)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={22} color="#3B82F6" />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Start a New Match</div>
            <div style={{ color: '#94A3B8', fontSize: 12 }}>Pick teams, select sport, go live</div>
          </div>
        </div>
        <button
          type="button"
          className="figma-btn-primary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}
          onClick={() => setShowNewModal(true)}
        >
          <Plus size={18} /> Start New Match
        </button>
      </div>

      {/* Supported sports chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {SPORTS.map((s) => (
          <div
            key={s}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'var(--figma-card, #1E293B)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>{SPORT_ICONS[s]}</span>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>{s}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { key: 'all', label: 'All' },
          { key: 'in_progress', label: 'Live' },
          { key: 'scheduled', label: 'Upcoming' },
          { key: 'completed', label: 'Done' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            style={{
              flexShrink: 0,
              padding: '7px 16px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: filter === key ? 'var(--figma-primary, #3B82F6)' : 'var(--figma-card, #1E293B)',
              color: '#fff',
              fontSize: 13,
              fontWeight: filter === key ? 600 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Match list */}
      <div className="figma-space-y-4">
        {filtered.map((m) => {
          const scoreSummary = getScoreSummary(m);
          return (
            <div key={m.id} className="figma-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{SPORT_ICONS[m.sport] || '🏅'}</span>
                  <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.12)', color: '#3B82F6', fontSize: 12, fontWeight: 500 }}>{m.sport}</span>
                </div>
                {getStatusBadge(m.status)}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{m.team1?.name}</span>
                <div style={{ textAlign: 'center' }}>
                  {scoreSummary ? (
                    <span style={{ color: m.status === 'in_progress' ? '#22C55E' : '#fff', fontSize: 18, fontWeight: 700 }}>{scoreSummary}</span>
                  ) : (
                    <span style={{ color: '#64748B', fontSize: 13 }}>vs</span>
                  )}
                </div>
                <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{m.team2?.name}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 12, marginBottom: 14 }}>
                <Clock size={12} />
                <span>{m.date} · {m.time}</span>
                <span>·</span>
                <span>{m.venue}</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {m.status === 'in_progress' && (
                  <button
                    type="button"
                    className="figma-btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}
                    onClick={() => onSelectMatch && onSelectMatch(m)}
                  >
                    <Activity size={15} /> Update Score
                  </button>
                )}
                {m.status === 'scheduled' && (
                  <button
                    type="button"
                    className="figma-btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}
                    onClick={() => onSelectMatch && onSelectMatch(m)}
                  >
                    <Play size={15} /> Start Scoring
                  </button>
                )}
                {m.status === 'completed' && (
                  <button
                    type="button"
                    className="figma-btn-ghost"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}
                    onClick={() => onSelectMatch && onSelectMatch(m)}
                  >
                    <Eye size={15} /> View Result
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <CheckCircle size={40} color="#1E293B" style={{ marginBottom: 12 }} />
          <div style={{ color: '#94A3B8', fontSize: 14 }}>No matches in this category.</div>
          <button
            type="button"
            className="figma-btn-primary"
            style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowNewModal(true)}
          >
            <Plus size={16} /> Start a Match
          </button>
        </div>
      )}
    </div>
  );
}
