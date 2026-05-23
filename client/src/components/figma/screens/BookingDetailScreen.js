import React from 'react';
import { ChevronLeft, MapPin, Calendar, Clock } from 'lucide-react';

export function BookingDetailScreen({ booking, onBack, onCancel, onModify }) {
  const b = booking || {};
  const venue = b.venue || { name: 'Elite Sports Arena', location: 'Koregaon Park' };

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Booking Details</span>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{venue.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14, marginBottom: 12 }}>
          <MapPin size={14} /> {venue.location}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>
          <Calendar size={14} /> {b.date}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14 }}>
          <Clock size={14} /> {b.timeRange}
        </div>
        {b.facility && (
          <div style={{ color: '#94A3B8', fontSize: 14, marginTop: 8 }}>Facility: {b.facility}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="figma-btn-ghost" style={{ flex: 1 }} onClick={() => onModify && onModify()}>
          Modify
        </button>
        <button
          style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          onClick={() => onCancel && onCancel()}
        >
          Cancel Booking
        </button>
      </div>
    </div>
  );
}
