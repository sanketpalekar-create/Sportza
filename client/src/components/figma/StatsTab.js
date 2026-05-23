import React from 'react';
import { Trophy, Clock, Target, Zap, Flame, Award, BarChart3, ArrowRight } from 'lucide-react';

const stats = { totalGames: 42, hoursPlayed: 87, winRate: 68, streak: 5, longestStreak: 8, openPlaySessions: 15, trainingHours: 24 };
const recentActivity = [
  { sport: 'Badminton', venue: 'Elite Sports Arena', date: 'Feb 20', result: 'Win', score: '21-18, 21-19', opponent: 'Rahul M.' },
  { sport: 'Tennis', venue: 'Phoenix Tennis Club', date: 'Feb 18', result: 'Loss', score: '4-6, 6-7', opponent: 'Priya V.' },
  { sport: 'Football', venue: 'Champions Football Arena', date: 'Feb 15', result: 'Win', score: '3-2', opponent: 'Team B' },
  { sport: 'Cricket', venue: 'Champions Arena', date: 'Feb 12', result: 'Win', score: '156/4 vs 142/8', opponent: 'Club XI' },
];
const sportsBreakdown = [
  { sport: 'Badminton', games: 18, color: '#3B82F6', percentage: 43 },
  { sport: 'Football', games: 12, color: '#60A5FA', percentage: 29 },
  { sport: 'Cricket', games: 8, color: '#8B5CF6', percentage: 19 },
  { sport: 'Tennis', games: 4, color: '#F59E0B', percentage: 9 },
];
const achievements = [
  { id: 1, title: 'Early Bird', description: '10 morning sessions', icon: '🌅', unlocked: true },
  { id: 2, title: 'Streak Master', description: '5 wins in a row', icon: '🔥', unlocked: true },
  { id: 3, title: 'Social Player', description: 'Join 20 open play sessions', icon: '🤝', unlocked: false, progress: '15/20' },
  { id: 4, title: 'Multi-Sport', description: 'Play 4 different sports', icon: '🏅', unlocked: true },
  { id: 5, title: 'Century Club', description: 'Play 100 games', icon: '💯', unlocked: false, progress: '42/100' },
  { id: 6, title: 'Training Devotee', description: '50 training hours', icon: '🎯', unlocked: false, progress: '24/50' },
];

export function StatsTab({ onViewSportAnalytics }) {
  return (
    <div className="figma-page">
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Your Stats</h1>
          <p className="figma-body">Track your performance</p>
        </div>
      </div>
      <div className="figma-grid2 figma-gap4" style={{ marginBottom: '2rem' }}>
        <div style={{ background: '#3B82F6', padding: 16, borderRadius: 16 }}>
          <Trophy size={24} color="#fff" style={{ marginBottom: 12 }} />
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{stats.totalGames}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 500 }}>Total Games</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <Clock size={24} color="#3B82F6" style={{ marginBottom: 12 }} />
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{stats.hoursPlayed}h</div>
          <div className="figma-body">Hours Played</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <Target size={24} color="#3B82F6" style={{ marginBottom: 12 }} />
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{stats.winRate}%</div>
          <div className="figma-body">Win Rate</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <Flame size={24} color="#EF4444" style={{ marginBottom: 12 }} />
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{stats.longestStreak}</div>
          <div className="figma-body">Longest Streak</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <Zap size={24} color="#F59E0B" style={{ marginBottom: 12 }} />
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{stats.streak}</div>
          <div className="figma-body">Current Streak</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <Award size={24} color="#8B5CF6" style={{ marginBottom: 12 }} />
          <div style={{ color: '#fff', fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{stats.trainingHours}h</div>
          <div className="figma-body">Training Hours</div>
        </div>
      </div>
      {onViewSportAnalytics && (
        <button
          type="button"
          onClick={onViewSportAnalytics}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 16, marginBottom: '2rem', borderRadius: 16, border: '1px solid rgba(59,130,246,0.25)', background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.08) 100%)', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 size={24} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Sport Analytics</div>
            <div style={{ color: '#94A3B8', fontSize: 13 }}>Detailed career stats by sport</div>
          </div>
          <ArrowRight size={20} color="#3B82F6" />
        </button>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h2 className="figma-heading2" style={{ marginBottom: 16 }}>Recent Activity</h2>
        <div className="figma-space-y-4">
          {recentActivity.map((a, i) => (
            <div key={i} className="figma-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{a.sport}</div>
                  <div style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>{a.venue}</div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 999, background: a.result === 'Win' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: a.result === 'Win' ? '#22C55E' : '#EF4444', fontSize: 12, fontWeight: 500 }}>{a.result}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748B', fontSize: 13 }}>
                <span>{a.date} &bull; vs {a.opponent}</span>
                <span style={{ color: '#94A3B8' }}>{a.score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: '2rem' }}>
        <h2 className="figma-heading2" style={{ marginBottom: 16 }}>Sports Breakdown</h2>
        <div className="figma-space-y-4">
          {sportsBreakdown.map((s) => (
            <div key={s.sport}>
              <div className="figma-flex-between" style={{ marginBottom: 8 }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{s.sport}</span>
                <span style={{ color: '#94A3B8', fontSize: 14 }}>{s.games} games</span>
              </div>
              <div style={{ height: 8, background: 'var(--figma-card)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${s.percentage}%`, height: '100%', background: s.color, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="figma-heading2" style={{ marginBottom: 16 }}>Achievements</h2>
        <div className="figma-grid2 figma-gap4">
          {achievements.map((ach) => (
            <div key={ach.id} className="figma-card figma-flex-col figma-gap2" style={{ padding: 16, opacity: ach.unlocked ? 1 : 0.6 }}>
              <span style={{ fontSize: 28 }}>{ach.icon}</span>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{ach.title}</div>
              <div style={{ color: '#94A3B8', fontSize: 12 }}>{ach.description}</div>
              {!ach.unlocked && ach.progress && (
                <div style={{ color: '#64748B', fontSize: 11, fontWeight: 500 }}>{ach.progress}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
