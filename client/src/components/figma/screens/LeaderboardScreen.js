import React, { useState } from 'react';
import { ChevronLeft, Trophy, Medal } from 'lucide-react';

const SPORTS = ['Badminton', 'Tennis', 'Football', 'Cricket', 'Pickleball', 'All'];

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'Rahul K.', points: 2840, games: 42, winRate: 72 },
  { rank: 2, name: 'Priya S.', points: 2610, games: 38, winRate: 68 },
  { rank: 3, name: 'Arjun P.', points: 2450, games: 40, winRate: 65 },
  { rank: 4, name: 'Meera N.', points: 2280, games: 35, winRate: 71 },
  { rank: 5, name: 'Vikram R.', points: 2120, games: 36, winRate: 61 },
  { rank: 6, name: 'Ananya M.', points: 1980, games: 32, winRate: 59 },
  { rank: 7, name: 'Karan J.', points: 1850, games: 30, winRate: 63 },
  { rank: 8, name: 'You', points: 1720, games: 28, winRate: 68 },
];

export function LeaderboardScreen({ onBack }) {
  const [sport, setSport] = useState('Badminton');

  const getRankBg = (rank) => {
    if (rank === 1) return { background: '#F59E0B', color: '#fff' };
    if (rank === 2) return { background: '#94A3B8', color: '#fff' };
    if (rank === 3) return { background: '#B45309', color: '#fff' };
    return { background: 'var(--figma-card)', color: '#94A3B8' };
  };

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Leaderboard</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, overflowX: 'auto', paddingBottom: 4 }}>
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: sport === s ? 'var(--figma-primary)' : 'var(--figma-card)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Trophy size={20} color="#F59E0B" />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{sport} rankings</span>
        </div>
        <div style={{ color: '#94A3B8', fontSize: 12 }}>Points from matches this month</div>
      </div>

      <div className="figma-space-y-2">
        {MOCK_LEADERBOARD.map((p) => (
          <div key={p.rank} className="figma-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, ...getRankBg(p.rank) }}>
              {p.rank <= 3 ? <Medal size={20} /> : p.rank}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{p.name}</div>
              <div style={{ color: '#94A3B8', fontSize: 12 }}>{p.games} games, {p.winRate}% win rate</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#3B82F6', fontSize: 18, fontWeight: 700 }}>{p.points}</div>
              <div style={{ color: '#64748B', fontSize: 11 }}>pts</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
