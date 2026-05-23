import React, { useState } from 'react';
import { Settings, CheckCircle2, XCircle, IndianRupee, Wrench, Clock } from 'lucide-react';

const INITIAL_FACILITIES = [
  { id: 1, name: 'Football Turf', sport: 'Football', surfaceType: 'Synthetic Turf', priceWeekday: 1500, priceWeekend: 2000, maintenance: false, available: true, slots: 16, bookedToday: 4 },
  { id: 2, name: 'Badminton Court 1', sport: 'Badminton', surfaceType: 'Wooden Court', priceWeekday: 800, priceWeekend: 1000, maintenance: false, available: true, slots: 16, bookedToday: 6 },
  { id: 3, name: 'Badminton Court 2', sport: 'Badminton', surfaceType: 'Wooden Court', priceWeekday: 800, priceWeekend: 1000, maintenance: false, available: true, slots: 16, bookedToday: 3 },
  { id: 4, name: 'Cricket Nets', sport: 'Cricket', surfaceType: 'Artificial Turf', priceWeekday: 600, priceWeekend: 800, maintenance: true, available: false, slots: 16, bookedToday: 0 },
  { id: 5, name: 'Tennis Court', sport: 'Tennis', surfaceType: 'Hard Court', priceWeekday: 1200, priceWeekend: 1500, maintenance: false, available: true, slots: 14, bookedToday: 2 },
];

const sportIcons = { Cricket: '🏏', Badminton: '🏸', Football: '⚽', Tennis: '🎾', Basketball: '🏀' };

export function VenueFacilitiesTab() {
  const [facilities, setFacilities] = useState(INITIAL_FACILITIES);
  const [editingId, setEditingId] = useState(null);

  const toggleMaintenance = (id) => {
    setFacilities((prev) => prev.map((f) => f.id === id ? { ...f, maintenance: !f.maintenance, available: f.maintenance ? true : false } : f));
  };

  const toggleAvailable = (id) => {
    setFacilities((prev) => prev.map((f) => f.id === id ? { ...f, available: !f.available } : f));
  };

  const fmt = (n) => '₹' + n.toLocaleString('en-IN');

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Facilities</h1>
          <p className="figma-body">Manage your venue facilities</p>
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 12, fontWeight: 600 }}>
          Venue Mode
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {facilities.map((f) => {
          const occupancy = f.slots > 0 ? Math.round((f.bookedToday / f.slots) * 100) : 0;
          return (
            <div key={f.id} className="figma-card" style={{ padding: 16, opacity: f.maintenance ? 0.7 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 26 }}>{sportIcons[f.sport] || '🏅'}</span>
                  <div>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{f.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 11, fontWeight: 500 }}>{f.surfaceType}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {f.maintenance ? (
                    <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Wrench size={11} /> Maintenance
                    </span>
                  ) : f.available ? (
                    <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <CheckCircle2 size={11} /> Available
                    </span>
                  ) : (
                    <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <XCircle size={11} /> Unavailable
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ color: '#64748B', fontSize: 11, marginBottom: 2 }}>Weekday</div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{fmt(f.priceWeekday)}/hr</div>
                </div>
                <div style={{ flex: 1, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ color: '#64748B', fontSize: 11, marginBottom: 2 }}>Weekend</div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{fmt(f.priceWeekend)}/hr</div>
                </div>
                <div style={{ flex: 1, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ color: '#64748B', fontSize: 11, marginBottom: 2 }}>Today</div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{f.bookedToday}/{f.slots}</div>
                </div>
              </div>

              {!f.maintenance && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#64748B', fontSize: 11 }}>Occupancy</span>
                    <span style={{ color: '#94A3B8', fontSize: 11 }}>{occupancy}%</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${occupancy}%`, height: '100%', background: occupancy > 75 ? '#22C55E' : occupancy > 40 ? '#3B82F6' : '#F59E0B', borderRadius: 999 }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setEditingId(editingId === f.id ? null : f.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--figma-nav)', color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <IndianRupee size={13} /> Edit Pricing
                </button>
                <button type="button" onClick={() => toggleMaintenance(f.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: f.maintenance ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: f.maintenance ? '#22C55E' : '#F59E0B', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Wrench size={13} /> {f.maintenance ? 'End Maint.' : 'Maintenance'}
                </button>
                <button type="button" onClick={() => toggleAvailable(f.id)} disabled={f.maintenance} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: f.maintenance ? 'default' : 'pointer', opacity: f.maintenance ? 0.4 : 1, background: f.available ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: f.available ? '#EF4444' : '#22C55E', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Clock size={13} /> {f.available ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
