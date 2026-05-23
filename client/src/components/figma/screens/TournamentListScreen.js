import React, { useState, useEffect } from 'react';
import { ChevronLeft, Trophy, Calendar, MapPin, Users, ChevronRight, Search, RefreshCw, Plus } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const FORMAT_LABELS = {
  league: 'League', round_robin: 'Round Robin', knockout: 'Knockout',
  group_knockout: 'Group + Knockout', other: 'Other',
};

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  published: { label: 'Published', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  in_progress: { label: 'Live', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  completed: { label: 'Completed', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

const SPORT_ICONS = {
  cricket: '🏏', football: '⚽', badminton: '🏸', tennis: '🎾',
  basketball: '🏀', volleyball: '🏐', 'table tennis': '🏓', pickleball: '🏓',
};

const MOCK_TOURNAMENTS = [
  { _id: '1', name: 'Corporate Cricket League', sport: 'cricket', format: 'league', status: 'in_progress', teams: Array(8), startDate: '2026-03-15', venue: { name: 'Champions Arena' }, createdBy: { name: 'Admin' } },
  { _id: '2', name: 'Badminton Open 2026', sport: 'badminton', format: 'knockout', status: 'published', teams: Array(16), startDate: '2026-04-01', venue: { name: 'Elite Sports Arena' }, createdBy: { name: 'Admin' } },
  { _id: '3', name: 'Football Cup', sport: 'football', format: 'group_knockout', status: 'draft', teams: Array(12), startDate: '2026-04-15', location: { city: 'Pune' }, createdBy: { name: 'Rahul' } },
  { _id: '4', name: 'Tennis Masters', sport: 'tennis', format: 'round_robin', status: 'completed', teams: Array(4), startDate: '2026-02-10', venue: { name: 'Phoenix Tennis Club' }, winner: { name: 'Team Alpha' }, createdBy: { name: 'Admin' } },
];

const FILTER_OPTIONS = ['All', 'Live', 'Upcoming', 'Completed', 'My Tournaments'];

export function TournamentListScreen({ onBack, onSelectTournament, onCreateTournament }) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/tournaments`);
      setTournaments(res.data);
    } catch {
      setTournaments(MOCK_TOURNAMENTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTournaments(); }, []);

  const filtered = tournaments.filter(t => {
    if (search) {
      const s = search.toLowerCase();
      if (!t.name.toLowerCase().includes(s) && !t.sport?.toLowerCase().includes(s)) return false;
    }
    if (filter === 'Live') return t.status === 'in_progress';
    if (filter === 'Upcoming') return t.status === 'draft' || t.status === 'published';
    if (filter === 'Completed') return t.status === 'completed';
    if (filter === 'My Tournaments') return true;
    return true;
  });

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <h1 className="figma-heading2" style={{ margin: 0, flex: 1 }}>Tournaments</h1>
        <button type="button" onClick={fetchTournaments} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#94A3B8' }}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={18} color="#64748B" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text" placeholder="Search tournaments..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: 12, border: '1px solid var(--figma-border)', background: 'var(--figma-card)', color: '#fff', fontSize: 14, outline: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {FILTER_OPTIONS.map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', background: filter === f ? '#8B5CF6' : 'var(--figma-card)', color: '#fff', fontSize: 13, fontWeight: 500 }}>
            {f}
          </button>
        ))}
      </div>

      {onCreateTournament && (
        <button type="button" onClick={onCreateTournament}
          style={{ width: '100%', background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 'none', cursor: 'pointer', marginBottom: 20, color: '#fff', fontSize: 15, fontWeight: 600 }}>
          <Plus size={20} /> Create Tournament
        </button>
      )}

      {loading && tournaments.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading tournaments...</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(t => {
          const status = STATUS_CONFIG[t.status] || STATUS_CONFIG.draft;
          const icon = SPORT_ICONS[t.sport?.toLowerCase()] || '🏅';
          const venueName = t.venue?.name || t.location?.city || t.place?.name || '';
          return (
            <div key={t._id} className="figma-card" style={{ padding: 16, cursor: 'pointer' }}
              onClick={() => onSelectTournament && onSelectTournament(t)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 11, fontWeight: 500 }}>
                        {FORMAT_LABELS[t.format] || t.format}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: status.bg, color: status.color, fontSize: 11, fontWeight: 600 }}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} color="#64748B" style={{ flexShrink: 0, marginTop: 4 }} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, color: '#94A3B8', fontSize: 13 }}>
                {venueName && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {venueName}</span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={13} /> {t.teams?.length || 0} teams</span>
                {t.startDate && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {new Date(t.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                )}
              </div>

              {t.status === 'completed' && t.winner?.name && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Trophy size={16} color="#F59E0B" />
                  <span style={{ color: '#F59E0B', fontSize: 13, fontWeight: 600 }}>Winner: {t.winner.name}</span>
                </div>
              )}
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
            <Trophy size={40} color="#334155" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, marginBottom: 4 }}>No tournaments found</div>
            <div style={{ fontSize: 13 }}>Create one to get started</div>
          </div>
        )}
      </div>
    </div>
  );
}
