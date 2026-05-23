import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';

const BOOKINGS_BY_DATE = {
  '2026-03-11': [
    { id: 1, facility: 'Football Turf', time: '6:00 AM - 7:00 AM', player: 'Arjun Patel', type: 'Online', sport: 'Football', status: 'confirmed' },
    { id: 2, facility: 'Badminton Court 1', time: '7:00 AM - 8:00 AM', player: 'Sneha Gupta', type: 'Online', sport: 'Badminton', status: 'confirmed' },
    { id: 3, facility: 'Cricket Nets', time: '5:00 PM - 6:00 PM', player: 'Vikram Singh', type: 'Walk-in', sport: 'Cricket', status: 'pending' },
    { id: 4, facility: 'Football Turf', time: '7:00 PM - 8:00 PM', player: 'Priya Verma', type: 'Online', sport: 'Football', status: 'confirmed' },
  ],
  '2026-03-12': [
    { id: 5, facility: 'Badminton Court 2', time: '6:00 AM - 7:00 AM', player: 'Rahul Desai', type: 'Online', sport: 'Badminton', status: 'confirmed' },
    { id: 6, facility: 'Football Turf', time: '5:00 PM - 6:00 PM', player: 'Ananya Roy', type: 'Online', sport: 'Football', status: 'confirmed' },
  ],
  '2026-03-13': [
    { id: 7, facility: 'Cricket Nets', time: '7:00 AM - 8:00 AM', player: 'Karan Shah', type: 'Walk-in', sport: 'Cricket', status: 'pending' },
  ],
};

const sportIcons = { Cricket: '🏏', Badminton: '🏸', Football: '⚽', Tennis: '🎾', Basketball: '🏀' };
const STATUS_STYLE = {
  confirmed: { color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  cancelled: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

function generateWeekDates(startDate) {
  const dates = [];
  const d = new Date(startDate);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function formatDateKey(d) {
  return d.toISOString().split('T')[0];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function VenueBookingsTab() {
  const [selectedDate, setSelectedDate] = useState(new Date('2026-03-11'));
  const weekDates = generateWeekDates(selectedDate);
  const dateKey = formatDateKey(selectedDate);
  const bookings = BOOKINGS_BY_DATE[dateKey] || [];

  const shiftWeek = (dir) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + dir * 7);
    setSelectedDate(d);
  };

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Bookings</h1>
          <p className="figma-body">Manage venue bookings</p>
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 12, fontWeight: 600 }}>
          Venue Mode
        </div>
      </div>

      <div className="figma-card" style={{ padding: 14, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <button type="button" onClick={() => shiftWeek(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
            {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button type="button" onClick={() => shiftWeek(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
            <ChevronRight size={20} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {weekDates.map((d) => {
            const key = formatDateKey(d);
            const isSelected = key === dateKey;
            const hasBookings = BOOKINGS_BY_DATE[key] && BOOKINGS_BY_DATE[key].length > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(d)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: isSelected ? '#22C55E' : 'transparent',
                  color: isSelected ? '#fff' : '#94A3B8',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 500 }}>{DAY_NAMES[d.getDay()]}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: isSelected ? '#fff' : '#fff' }}>{d.getDate()}</span>
                {hasBookings && !isSelected && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E' }} />}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="figma-heading2">
          {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </h2>
        <span style={{ color: '#94A3B8', fontSize: 13 }}>{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</span>
      </div>

      {bookings.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bookings.map((bk) => {
            const st = STATUS_STYLE[bk.status] || STATUS_STYLE.confirmed;
            return (
              <div key={bk.id} className="figma-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{sportIcons[bk.sport] || '🏅'}</span>
                    <div>
                      <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{bk.facility}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 12 }}>
                        <Clock size={12} /> {bk.time}
                      </div>
                    </div>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: 999, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600 }}>{bk.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 13 }}>
                    <User size={13} /> {bk.player}
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: bk.type === 'Online' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)', color: bk.type === 'Online' ? '#3B82F6' : '#F59E0B' }}>{bk.type}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 14 }}>No bookings on this day.</div>
      )}
    </div>
  );
}
