import React, { useState, useMemo } from 'react';
import { ChevronLeft, Search, ChevronRight, TrendingUp, Trophy, ArrowUpDown } from 'lucide-react';

const SPORTS_DATA = [
  { id: 'cricket', name: 'Cricket', icon: '🏏', matches: 28, topMetric: { label: 'Avg Score', value: '42.5' }, color: '#3B82F6' },
  { id: 'badminton', name: 'Badminton', icon: '🏸', matches: 35, topMetric: { label: 'Win Rate', value: '71%' }, color: '#8B5CF6' },
  { id: 'tennis', name: 'Tennis', icon: '🎾', matches: 18, topMetric: { label: 'Aces/Match', value: '4.2' }, color: '#22C55E' },
  { id: 'football', name: 'Football', icon: '⚽', matches: 22, topMetric: { label: 'Goals', value: '14' }, color: '#F59E0B' },
  { id: 'basketball', name: 'Basketball', icon: '🏀', matches: 12, topMetric: { label: 'Points/Game', value: '18.4' }, color: '#EF4444' },
  { id: 'volleyball', name: 'Volleyball', icon: '🏐', matches: 8, topMetric: { label: 'Kills/Set', value: '3.1' }, color: '#06B6D4' },
  { id: 'table-tennis', name: 'Table Tennis', icon: '🏓', matches: 15, topMetric: { label: 'Win Rate', value: '67%' }, color: '#EC4899' },
  { id: 'pickleball', name: 'Pickleball', icon: '🏓', matches: 14, topMetric: { label: 'Win Rate', value: '70%' }, color: '#14B8A6' },
  { id: 'hockey', name: 'Hockey', icon: '🏑', matches: 6, topMetric: { label: 'Goals', value: '5' }, color: '#F97316' },
  { id: 'squash', name: 'Squash', icon: '🎯', matches: 4, topMetric: { label: 'Win Rate', value: '75%' }, color: '#A855F7' },
  { id: 'swimming', name: 'Swimming', icon: '🏊', matches: 10, topMetric: { label: 'Best Time', value: '28.4s' }, color: '#0EA5E9' },
  { id: 'athletics', name: 'Athletics', icon: '🏃', matches: 7, topMetric: { label: 'Events', value: '3' }, color: '#F97316' },
  { id: 'kabaddi', name: 'Kabaddi', icon: '🤼', matches: 5, topMetric: { label: 'Raid Pts', value: '22' }, color: '#DC2626' },
  { id: 'boxing', name: 'Boxing', icon: '🥊', matches: 3, topMetric: { label: 'Win Rate', value: '100%' }, color: '#B91C1C' },
  { id: 'cycling', name: 'Cycling', icon: '🚴', matches: 9, topMetric: { label: 'Avg Speed', value: '28km/h' }, color: '#65A30D' },
  { id: 'pickleball', name: 'Pickleball', icon: '🏓', matches: 11, topMetric: { label: 'Win Rate', value: '64%' }, color: '#D946EF' },
];

const SORT_OPTIONS = [
  { id: 'most-played', label: 'Most Played' },
  { id: 'recent', label: 'Recently Played' },
  { id: 'alpha', label: 'A - Z' },
];

export function SportAnalyticsHub({ onBack, onSelectSport }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('most-played');
  const [showSort, setShowSort] = useState(false);

  const totalMatches = SPORTS_DATA.reduce((s, sp) => s + sp.matches, 0);
  const activeSports = SPORTS_DATA.filter((s) => s.matches > 0).length;

  const filtered = useMemo(() => {
    let list = [...SPORTS_DATA];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (sortBy === 'most-played') list.sort((a, b) => b.matches - a.matches);
    else if (sortBy === 'alpha') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [search, sortBy]);

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <span className="figma-heading2" style={{ margin: 0 }}>Sport Analytics</span>
          <div style={{ color: '#94A3B8', fontSize: 12 }}>Detailed career performance by sport</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{ flex: 1, background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', borderRadius: 14, padding: 14, textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{activeSports}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>Sports Played</div>
        </div>
        <div style={{ flex: 1, background: 'var(--figma-card)', border: '1px solid var(--figma-border)', borderRadius: 14, padding: 14, textAlign: 'center' }}>
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{totalMatches}</div>
          <div style={{ color: '#94A3B8', fontSize: 12 }}>Total Matches</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            type="text"
            placeholder="Search sports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid var(--figma-border)', background: 'var(--figma-card)', color: '#fff', fontSize: 14, outline: 'none' }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowSort(!showSort)}
            style={{ height: '100%', padding: '0 14px', borderRadius: 12, border: '1px solid var(--figma-border)', background: 'var(--figma-card)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <ArrowUpDown size={14} />
          </button>
          {showSort && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#1E293B', border: '1px solid var(--figma-border)', borderRadius: 12, overflow: 'hidden', zIndex: 20, minWidth: 160 }}>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { setSortBy(opt.id); setShowSort(false); }}
                  style={{ width: '100%', padding: '10px 14px', background: sortBy === opt.id ? 'rgba(59,130,246,0.15)' : 'transparent', border: 'none', cursor: 'pointer', color: sortBy === opt.id ? '#3B82F6' : '#fff', fontSize: 13, fontWeight: 500, textAlign: 'left' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((sport) => (
          <button
            key={sport.id}
            type="button"
            onClick={() => onSelectSport && onSelectSport(sport)}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, background: 'var(--figma-card)', border: '1px solid var(--figma-border)', borderRadius: 16, cursor: 'pointer', width: '100%', textAlign: 'left' }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${sport.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
              {sport.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{sport.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#94A3B8', fontSize: 13 }}>{sport.matches} matches</span>
                <span style={{ width: 1, height: 12, background: 'var(--figma-border)' }} />
                <span style={{ color: sport.color, fontSize: 13, fontWeight: 600 }}>{sport.topMetric.label}: {sport.topMetric.value}</span>
              </div>
            </div>
            <ChevronRight size={20} color="#64748B" />
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 14 }}>No sports match your search.</div>
        )}
      </div>
    </div>
  );
}
