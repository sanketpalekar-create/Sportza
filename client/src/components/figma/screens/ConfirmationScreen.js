import React, { useEffect } from 'react';
import { CheckCircle, Calendar, Users, Eye } from 'lucide-react';
import { useNav } from '../../../context/NavContext';

export function ConfirmationScreen({ booking, bookingId, onAddToCalendar, onCreateOpenPlay, onViewBooking }) {
  const { setHideBottomNav } = useNav();

  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  const b = booking || {};
  const id = bookingId || 'BK' + Date.now().toString(36).toUpperCase();

  return (
    <div className="figma-page" style={{ paddingBottom: 24, textAlign: 'center' }}>
      <div style={{ padding: '32px 0 24px' }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'block', objectFit: 'contain', objectPosition: '51% 52%' }} />
        <CheckCircle size={64} color="#22C55E" style={{ marginBottom: 16 }} />
        <h1 className="figma-heading1" style={{ marginBottom: 8 }}>Booking Confirmed</h1>
        <p style={{ color: '#94A3B8', fontSize: 14 }}>Booking ID: {id}</p>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20, textAlign: 'left' }}>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{b.venue && b.venue.name}</div>
        <div style={{ color: '#94A3B8', fontSize: 14 }}>{b.date} · {b.timeRange}</div>
        {b.facilities && b.facilities.length > 0 ? (
          <div style={{ marginTop: 6 }}>
            {b.facilities.map((f) => {
              const fObj = typeof f === 'string' ? { name: f } : f;
              return (
                <div key={fObj.name} style={{ color: '#94A3B8', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span>{fObj.name}</span>
                  {fObj.surfaceType && (
                    <span style={{ fontSize: 12, color: '#60A5FA', background: 'rgba(59,130,246,0.1)', borderRadius: 6, padding: '1px 6px' }}>
                      {fObj.surfaceType}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: '#94A3B8', fontSize: 14 }}>{b.facility}</div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="figma-btn-ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => onAddToCalendar && onAddToCalendar()}>
          <Calendar size={20} /> Add to Calendar
        </button>
        <button className="figma-btn-ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => onCreateOpenPlay && onCreateOpenPlay()}>
          <Users size={20} /> Create Open Play
        </button>
        <button className="figma-btn-primary" style={{ width: '100%' }} onClick={() => onViewBooking && onViewBooking()}>
          <Eye size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} /> View Booking
        </button>
      </div>
    </div>
  );
}
