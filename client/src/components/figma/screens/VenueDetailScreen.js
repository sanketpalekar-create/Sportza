import React, { useState } from 'react';
import { ChevronLeft, MapPin, Star, MessageSquare, ChevronRight, Check } from 'lucide-react';
import { ImageWithFallback } from '../ImageWithFallback';

const FACILITIES = [
  { name: 'Turf 1', surfaceType: 'Synthetic Turf' },
  { name: 'Turf 2', surfaceType: 'Astroturf' },
  { name: 'Court 1', surfaceType: 'Wooden' },
];
const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return { label: i === 0 ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' }), date: d.toISOString().slice(0, 10) };
});

export function VenueDetailScreen({ venue, onBack, onSelectSlot, onViewReviews }) {
  const [selectedFacilities, setSelectedFacilities] = useState([FACILITIES[0].name]);
  const [selectedDate, setSelectedDate] = useState(DATES[0].date);
  const v = venue || { id: '1', name: 'Elite Sports Arena', location: 'Koregaon Park', image: 'https://images.unsplash.com/photo-1624024834874-2a1611305604?w=400&q=80', rating: 4.8, sport: 'Badminton', pricePerHour: 800 };
  const reviewCount = v.reviewCount ?? 24;

  const toggleFacility = (name) => {
    setSelectedFacilities((prev) => {
      if (prev.includes(name)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== name);
      }
      return [...prev, name];
    });
  };

  const getSelectedFacilityObjects = () =>
    FACILITIES.filter((f) => selectedFacilities.includes(f.name));

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}><ChevronLeft size={24} /></button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Venue</span>
      </div>
      <div style={{ height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
        <ImageWithFallback src={v.image} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <h1 className="figma-heading1" style={{ marginBottom: 8 }}>{v.name}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#F59E0B', fontSize: 14 }}><Star size={16} fill="#F59E0B" /> {v.rating ?? 4.8}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 14 }}><MapPin size={14} /> {v.location}</span>
      </div>
      <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 20 }}>₹{v.pricePerHour} per hour</p>

      {/* Ratings & reviews block */}
      <div
        className="figma-card"
        style={{ padding: 16, marginBottom: 20, cursor: onViewReviews ? 'pointer' : 'default' }}
        onClick={() => onViewReviews && onViewReviews(v)}
        role={onViewReviews ? 'button' : undefined}
        tabIndex={onViewReviews ? 0 : undefined}
        onKeyDown={(e) => onViewReviews && e.key === 'Enter' && onViewReviews(v)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Star size={20} color="#F59E0B" fill="#F59E0B" />
            <div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{v.rating ?? 4.8} · {reviewCount} reviews</div>
              <div style={{ color: '#94A3B8', fontSize: 13 }}>Tap to see all or write a review</div>
            </div>
          </div>
          {onViewReviews && <ChevronRight size={20} color="#64748B" />}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span className="figma-body">Facility</span>
          {selectedFacilities.length > 1 && (
            <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>
              {selectedFacilities.length} courts selected
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FACILITIES.map((f) => {
            const isSelected = selectedFacilities.includes(f.name);
            return (
              <button key={f.name} onClick={() => toggleFacility(f.name)} style={{
                padding: '10px 16px', borderRadius: 12,
                border: isSelected ? '2px solid #3B82F6' : '1px solid var(--figma-border)',
                background: isSelected ? 'rgba(59,130,246,0.15)' : 'var(--figma-card)',
                color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {isSelected && <Check size={14} color="#3B82F6" strokeWidth={3} />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span>{f.name}</span>
                  {f.surfaceType && (
                    <span style={{ fontSize: 11, color: isSelected ? '#60A5FA' : '#64748B', fontWeight: 400 }}>
                      {f.surfaceType}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p style={{ color: '#64748B', fontSize: 12, marginTop: 6 }}>
          Tap multiple courts to book them together
        </p>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div className="figma-body" style={{ marginBottom: 10 }}>Date</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {DATES.map((d) => (
            <button key={d.date} onClick={() => setSelectedDate(d.date)} style={{ flexShrink: 0, padding: '12px 16px', borderRadius: 12, border: selectedDate === d.date ? '2px solid #3B82F6' : '1px solid var(--figma-border)', background: selectedDate === d.date ? 'rgba(59,130,246,0.15)' : 'var(--figma-card)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{d.label}</button>
          ))}
        </div>
      </div>
      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="figma-body" style={{ marginBottom: 8 }}>Time slot preview</div>
        <p style={{ color: '#fff', fontSize: 14 }}>Morning, Afternoon & Evening slots available. Tap below to choose.</p>
      </div>
      <div style={{ position: 'sticky', bottom: 0, paddingTop: 16, background: 'var(--figma-bg)' }}>
        <button className="figma-btn-primary" style={{ width: '100%' }} onClick={() => onSelectSlot && onSelectSlot({ venue: v, facilities: getSelectedFacilityObjects(), date: selectedDate })}>
          {selectedFacilities.length > 1
            ? `Select Slots for ${selectedFacilities.length} Courts`
            : 'Select Slot'}
        </button>
      </div>
    </div>
  );
}
