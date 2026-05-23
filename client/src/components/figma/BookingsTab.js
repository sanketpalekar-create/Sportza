import React from 'react';
import { MapPin, Clock, Calendar as CalendarIcon, CheckCircle2, MoreVertical, CreditCard, ArrowRight } from 'lucide-react';

export function BookingsTab({ onSelectBookingDetail, onViewPaymentHistory }) {
  const bookings = [
    { id: 1, venue: 'Elite Sports Arena', sport: 'Badminton', location: 'Koregaon Park', date: 'Feb 20, 2026', time: '6:00 PM - 7:00 PM', court: 'Court 2', status: 'confirmed', price: '₹800' },
    { id: 2, venue: 'Phoenix Tennis Club', sport: 'Tennis', location: 'Baner', date: 'Feb 22, 2026', time: '8:00 AM - 9:30 AM', court: 'Court 1', status: 'confirmed', price: '₹1200' },
    { id: 3, venue: 'Champions Football Arena', sport: 'Football', location: 'Hinjewadi', date: 'Feb 18, 2026', time: '5:00 PM - 6:00 PM', court: 'Field A', status: 'completed', price: '₹1500' },
    { id: 4, venue: 'Victory Cricket Ground', sport: 'Cricket', location: 'Wakad', date: 'Feb 15, 2026', time: '9:00 AM - 11:00 AM', court: 'Pitch 1', status: 'completed', price: '₹2000' },
  ];

  const upcoming = bookings.filter((b) => b.status === 'confirmed');
  const past = bookings.filter((b) => b.status === 'completed');

  const renderBookingCard = (booking, isPast) => (
    <div key={booking.id} className="figma-card" style={{ padding: 16, opacity: isPast ? 0.6 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>{booking.venue}</h3>
            <span className={`figma-badge ${isPast ? '' : 'figma-badge-primary'}`} style={isPast ? { background: 'rgba(148,163,184,0.15)', color: '#94A3B8' } : {}}>{booking.sport}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 14, marginBottom: 12 }}>
            <MapPin size={14} /> <span>{booking.location}</span>
          </div>
        </div>
        {!isPast && (
          <button style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 12 }}><MoreVertical size={20} color="#94A3B8" /></button>
        )}
        {isPast && (
          <span className="figma-badge figma-badge-success" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> Completed
          </span>
        )}
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
          <CalendarIcon size={16} color="#94A3B8" /> <span style={{ color: '#fff' }}>{booking.date}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500 }}>
          <Clock size={16} color="#94A3B8" /> <span style={{ color: '#fff' }}>{booking.time}</span>
        </div>
      </div>
      <div className="figma-divider" style={{ paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#64748B', fontSize: 12, marginBottom: 4 }}>{booking.court}</div>
          <div style={{ color: isPast ? '#94A3B8' : '#3B82F6', fontSize: 18, fontWeight: 600 }}>{booking.price}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isPast && <button className="figma-btn-ghost">Cancel</button>}
          <button className={isPast ? 'figma-btn-ghost' : 'figma-btn-primary'} onClick={() => onSelectBookingDetail && onSelectBookingDetail({ venue: { name: booking.venue, location: booking.location }, date: booking.date, timeRange: booking.time, facility: booking.court })}>{isPast ? 'Rebook' : 'Details'}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>My Bookings</h1>
          <p className="figma-body">Manage your court reservations</p>
        </div>
      </div>

      <div className="figma-grid2" style={{ marginBottom: '1rem' }}>
        <div className="figma-card" style={{ padding: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <CheckCircle2 size={20} color="#22C55E" />
          </div>
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{upcoming.length}</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>Upcoming</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <CalendarIcon size={20} color="#3B82F6" />
          </div>
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{past.length}</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>Completed</div>
        </div>
      </div>

      {onViewPaymentHistory && (
        <button type="button" className="figma-card" style={{ width: '100%', padding: 16, marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--figma-border)', cursor: 'pointer', background: 'var(--figma-card)', color: '#fff', textAlign: 'left' }} onClick={() => onViewPaymentHistory()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(148,163,184,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={20} color="#94A3B8" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Payment History</div>
              <div style={{ color: '#94A3B8', fontSize: 13, marginTop: 2 }}>View receipts and past payments</div>
            </div>
          </div>
          <ArrowRight size={20} color="#94A3B8" />
        </button>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h2 className="figma-heading2" style={{ marginBottom: 16 }}>Upcoming</h2>
        <div className="figma-space-y-4">{upcoming.map((b) => renderBookingCard(b, false))}</div>
      </div>

      <div>
        <h2 className="figma-heading2" style={{ marginBottom: 16 }}>Past</h2>
        <div className="figma-space-y-4">{past.map((b) => renderBookingCard(b, true))}</div>
      </div>
    </div>
  );
}
