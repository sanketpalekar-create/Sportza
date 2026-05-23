import React, { useState, useMemo } from 'react';
import { ChevronLeft, Search, MapPin, Star } from 'lucide-react';

const SPORT_FILTERS = ['All', 'Badminton', 'Tennis', 'Cricket', 'Football', 'Basketball', 'Pickleball'];
const MOCK_TRAINERS = [
  { id: '1', name: 'Arjun Kumar', sports: ['Badminton', 'Tennis'], city: 'Pune', rating: 4.9, reviewCount: 48 },
  { id: '2', name: 'Meera Sharma', sports: ['Tennis'], city: 'Pune', rating: 4.8, reviewCount: 32 },
  { id: '3', name: 'Vikram Singh', sports: ['Cricket', 'Football'], city: 'Mumbai', rating: 4.7, reviewCount: 56 },
  { id: '4', name: 'Sneha Patel', sports: ['Badminton'], city: 'Pune', rating: 4.6, reviewCount: 21 },
];

export function TrainerListScreen({ onBack, onSelectTrainer }) {
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('All');

  const filtered = useMemo(() => {
    let list = MOCK_TRAINERS;
    if (sportFilter !== 'All') list = list.filter((t) => (t.sports || []).includes(sportFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.city.toLowerCase().includes(q) || (t.sports || []).some((s) => s.toLowerCase().includes(q)));
    }
    return list;
  }, [search, sportFilter]);

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Find Trainers</span>
      </div>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={20} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
        <input
          type="text"
          placeholder="Search by name, sport, city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '14px 16px 14px 44px', borderRadius: 12, border: '1px solid var(--figma-border)', background: 'var(--figma-card)', color: '#fff', fontSize: 16, outline: 'none' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {SPORT_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setSportFilter(s)}
            style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', background: sportFilter === s ? 'var(--figma-primary)' : 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 500 }}
          >
            {s}
          </button>
        ))}
      </div>
      <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 12 }}>{filtered.length} trainer{filtered.length !== 1 ? 's' : ''} found</div>
      <div className="figma-space-y-4">
        {filtered.map((trainer) => (
          <div key={trainer.id} className="figma-card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => onSelectTrainer && onSelectTrainer(trainer)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelectTrainer && onSelectTrainer(trainer)}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 600, flexShrink: 0 }}>
                {trainer.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{trainer.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 13, marginBottom: 6 }}>
                  <MapPin size={12} /> {trainer.city}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#F59E0B' }}><Star size={12} fill="#F59E0B" /> {trainer.rating}</span>
                  <span style={{ color: '#94A3B8' }}>{trainer.reviewCount} reviews</span>
                  {(trainer.sports || (trainer.sport ? [trainer.sport] : [])).map((s) => (
                    <span key={s} style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 11, fontWeight: 500 }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8', fontSize: 14 }}>No trainers match your search.</div>}
    </div>
  );
}
