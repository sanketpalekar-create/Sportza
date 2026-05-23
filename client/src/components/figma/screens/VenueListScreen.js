import React, { useState, useMemo } from 'react';
import { ChevronLeft, Search, MapPin, Star, Users } from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';

const SPORT_FILTERS = ['All', 'Badminton', 'Tennis', 'Football', 'Cricket', 'Basketball'];

const MOCK_VENUES = [
  { id: 1, name: 'Elite Sports Arena', location: 'Koregaon Park', image: 'https://images.unsplash.com/photo-1624024834874-2a1611305604?w=400&q=80', sport: 'Badminton', rating: 4.8, price: '₹800', available: '2 slots' },
  { id: 2, name: 'Phoenix Tennis Club', location: 'Baner', image: 'https://images.unsplash.com/photo-1766675122854-28fc70f50132?w=400&q=80', sport: 'Tennis', rating: 4.9, price: '₹1200', available: '5 slots' },
  { id: 3, name: 'Champions Football Arena', location: 'Hinjewadi', image: 'https://images.unsplash.com/photo-1603508434829-7c4282d74483?w=400&q=80', sport: 'Football', rating: 4.6, price: '₹1500', available: '3 slots' },
  { id: 4, name: 'Victory Cricket Ground', location: 'Wakad', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=400&q=80', sport: 'Cricket', rating: 4.7, price: '₹2000', available: '1 slot' },
  { id: 5, name: 'Hoops Basketball Court', location: 'Viman Nagar', image: 'https://images.unsplash.com/photo-1710378844976-93a6538671ef?w=400&q=80', sport: 'Basketball', rating: 4.5, price: '₹600', available: '8 slots' },
  { id: 6, name: 'Shuttle Zone', location: 'Kalyani Nagar', image: 'https://images.unsplash.com/photo-1624024834874-2a1611305604?w=400&q=80', sport: 'Badminton', rating: 4.4, price: '₹700', available: '4 slots' },
];

export function VenueListScreen({ onBack, onSelectVenue }) {
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('All');

  const filtered = useMemo(() => {
    let list = MOCK_VENUES;
    if (sportFilter !== 'All') list = list.filter((v) => v.sport === sportFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((v) => v.name.toLowerCase().includes(q) || v.location.toLowerCase().includes(q) || v.sport.toLowerCase().includes(q));
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
        <span className="figma-heading2" style={{ margin: 0 }}>Venues</span>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={20} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
        <input
          type="text"
          placeholder="Search venues, location, sport..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px 14px 44px',
            borderRadius: 12,
            border: '1px solid var(--figma-border)',
            background: 'var(--figma-card)',
            color: '#fff',
            fontSize: 16,
            outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {SPORT_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setSportFilter(s)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: sportFilter === s ? 'var(--figma-primary)' : 'var(--figma-card)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 12 }}>{filtered.length} venue{filtered.length !== 1 ? 's' : ''} found</div>

      <div className="figma-space-y-4">
        {filtered.map((venue) => (
          <div key={venue.id} className="figma-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 16, padding: 16 }} onClick={() => onSelectVenue && onSelectVenue(venue)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelectVenue && onSelectVenue(venue)} style={{ cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 100, height: 100, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                <ImageWithFallback src={venue.image} alt={venue.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: 0 }}>{venue.name}</h3>
                  <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 11, fontWeight: 500 }}>{venue.sport}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>
                  <MapPin size={12} /> {venue.location}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#F59E0B' }}><Star size={12} fill="#F59E0B" /> {venue.rating}</span>
                  <span style={{ color: '#94A3B8' }}><Users size={12} /> {venue.available}</span>
                  <span style={{ color: '#3B82F6', fontWeight: 600 }}>{venue.price}<span style={{ color: '#64748B', fontWeight: 400 }}>/hr</span></span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8', fontSize: 14 }}>No venues match your search. Try a different filter or search term.</div>
      )}
    </div>
  );
}
