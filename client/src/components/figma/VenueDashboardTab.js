import React from 'react';
import { Calendar, IndianRupee, Clock, TrendingUp, Users, ChevronRight } from 'lucide-react';

const TODAY_BOOKINGS = [
  { id: 1, facility: 'Football Turf', time: '6:00 AM - 7:00 AM', player: 'Arjun Patel', type: 'Online', sport: 'Football' },
  { id: 2, facility: 'Badminton Court 1', time: '7:00 AM - 8:00 AM', player: 'Sneha Gupta', type: 'Online', sport: 'Badminton' },
  { id: 3, facility: 'Cricket Nets', time: '5:00 PM - 6:00 PM', player: 'Vikram Singh', type: 'Walk-in', sport: 'Cricket' },
  { id: 4, facility: 'Football Turf', time: '7:00 PM - 8:00 PM', player: 'Priya Verma', type: 'Online', sport: 'Football' },
];

const sportIcons = { Cricket: '🏏', Badminton: '🏸', Football: '⚽', Tennis: '🎾', Basketball: '🏀' };

export function VenueDashboardTab() {
  const occupancy = 68;

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Dashboard</h1>
          <p className="figma-body">Venue Owner Mode</p>
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 12, fontWeight: 600 }}>
          Venue Mode
        </div>
      </div>

      <div className="figma-grid2 figma-gap4" style={{ marginBottom: '2rem' }}>
        <div style={{ background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)', padding: 16, borderRadius: 16 }}>
          <Calendar size={22} color="#fff" style={{ marginBottom: 8 }} />
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{TODAY_BOOKINGS.length}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Today's Bookings</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <IndianRupee size={22} color="#22C55E" style={{ marginBottom: 8 }} />
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 2 }}>₹1.2L</div>
          <div className="figma-body">This Month</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <TrendingUp size={22} color="#3B82F6" style={{ marginBottom: 8 }} />
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{occupancy}%</div>
          <div className="figma-body">Slot Occupancy</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <Users size={22} color="#8B5CF6" style={{ marginBottom: 8 }} />
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 2 }}>156</div>
          <div className="figma-body">Total Customers</div>
        </div>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: '#94A3B8', fontSize: 13 }}>Slot Occupancy Today</span>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{occupancy}%</span>
        </div>
        <div style={{ height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ width: `${occupancy}%`, height: '100%', background: 'linear-gradient(90deg, #22C55E 0%, #3B82F6 100%)', borderRadius: 999 }} />
        </div>
      </div>

      <div>
        <h2 className="figma-heading2" style={{ marginBottom: 12 }}>Upcoming Bookings</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TODAY_BOOKINGS.map((bk) => (
            <div key={bk.id} className="figma-card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {sportIcons[bk.sport] || '🏅'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{bk.facility}</div>
                <div style={{ color: '#94A3B8', fontSize: 12 }}>{bk.player} &bull; {bk.time}</div>
              </div>
              <span style={{
                padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                background: bk.type === 'Online' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                color: bk.type === 'Online' ? '#3B82F6' : '#F59E0B',
              }}>{bk.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
