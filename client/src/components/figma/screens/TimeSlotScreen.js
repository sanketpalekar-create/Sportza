import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

const SLOTS = [
  { id: '1', start: '10:00', end: '11:00', period: 'Morning', available: true },
  { id: '2', start: '11:00', end: '12:00', period: 'Morning', available: true },
  { id: '3', start: '12:00', end: '13:00', period: 'Afternoon', available: false },
  { id: '4', start: '14:00', end: '15:00', period: 'Afternoon', available: true },
  { id: '5', start: '15:00', end: '16:00', period: 'Afternoon', available: true },
  { id: '6', start: '18:00', end: '19:00', period: 'Evening', available: true },
  { id: '7', start: '19:00', end: '20:00', period: 'Evening', available: true },
];

// Normalize a facility entry to { name, surfaceType } object
function normFacility(f) {
  if (typeof f === 'string') return { name: f, surfaceType: null };
  return { name: f.name || f, surfaceType: f.surfaceType || null };
}

// Simulate per-facility availability (in production, fetch from API)
function getSlotsForFacility(facilityName) {
  if (facilityName === 'Turf 2') {
    return SLOTS.map((s) => s.id === '4' ? { ...s, available: false } : s);
  }
  if (facilityName === 'Court 1') {
    return SLOTS.map((s) => s.id === '6' ? { ...s, available: false } : s);
  }
  return SLOTS;
}

export function TimeSlotScreen({ venue, facility, facilities, date, onBack, onContinue }) {
  const rawList = facilities && facilities.length > 0 ? facilities : (facility ? [facility] : ['Turf 1']);
  const facilityList = rawList.map(normFacility);
  const isMultiCourt = facilityList.length > 1;
  const [activeFacilityTab, setActiveFacilityTab] = useState(facilityList[0].name);
  const [selected, setSelected] = useState([]);
  const pricePerHour = venue?.pricePerHour || 800;
  const hours = selected.length;
  const courtCount = facilityList.length;
  const subtotal = hours * pricePerHour * courtCount;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  const currentSlots = getSlotsForFacility(activeFacilityTab);
  const activeFacility = facilityList.find((f) => f.name === activeFacilityTab) || facilityList[0];

  const toggle = (slot) => {
    if (!slot.available) return;
    setSelected((prev) => {
      const id = slot.id;
      if (prev.some((s) => s.id === id)) return prev.filter((s) => s.id !== id);
      return [...prev, slot].sort((a, b) => a.start.localeCompare(b.start));
    });
  };

  const isSlotAvailableOnAll = (slotId) => {
    return facilityList.every((f) => {
      const fSlots = getSlotsForFacility(f.name);
      const slot = fSlots.find((s) => s.id === slotId);
      return slot && slot.available;
    });
  };

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}><ChevronLeft size={24} /></button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Select time</span>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{date}</div>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
          {venue?.name} · {isMultiCourt ? `${courtCount} courts` : facilityList[0].name}
        </div>
        {!isMultiCourt && facilityList[0].surfaceType && (
          <div style={{ color: '#60A5FA', fontSize: 12, marginTop: 4 }}>
            Surface: {facilityList[0].surfaceType}
          </div>
        )}
        {isMultiCourt && (
          <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
            {facilityList.map((f) => f.surfaceType ? `${f.name} (${f.surfaceType})` : f.name).join(', ')}
          </div>
        )}
      </div>

      {/* Per-facility availability tabs for multi-court */}
      {isMultiCourt && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            <button
              onClick={() => setActiveFacilityTab(facilityList[0].name)}
              style={{
                padding: '8px 14px', borderRadius: 10, flexShrink: 0,
                border: activeFacilityTab === facilityList[0].name ? '2px solid #3B82F6' : '1px solid var(--figma-border)',
                background: activeFacilityTab === facilityList[0].name ? 'rgba(59,130,246,0.15)' : 'var(--figma-card)',
                color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              All Courts
            </button>
            {facilityList.map((f) => (
              <button
                key={f.name}
                onClick={() => setActiveFacilityTab(f.name)}
                style={{
                  padding: '8px 14px', borderRadius: 10, flexShrink: 0,
                  border: activeFacilityTab === f.name ? '2px solid #3B82F6' : '1px solid var(--figma-border)',
                  background: activeFacilityTab === f.name ? 'rgba(59,130,246,0.15)' : 'var(--figma-card)',
                  color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}
              >
                <span>{f.name}</span>
                {f.surfaceType && (
                  <span style={{ fontSize: 10, color: activeFacilityTab === f.name ? '#60A5FA' : '#64748B', fontWeight: 400 }}>
                    {f.surfaceType}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p style={{ color: '#64748B', fontSize: 11, marginTop: 6 }}>
            Slots are shared across all selected courts. A slot must be available on every court.
          </p>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        {['Morning', 'Afternoon', 'Evening'].map((period) => {
          const periodSlots = currentSlots.filter((s) => s.period === period);
          if (!periodSlots.length) return null;
          return (
            <div key={period} style={{ marginBottom: 16 }}>
              <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>{period}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {periodSlots.map((slot) => {
                  const isSelected = selected.some((s) => s.id === slot.id);
                  const availableOnAll = isMultiCourt ? isSlotAvailableOnAll(slot.id) : slot.available;
                  const canSelect = slot.available && (!isMultiCourt || availableOnAll);
                  return (
                    <button
                      key={slot.id}
                      onClick={() => canSelect && toggle(slot)}
                      disabled={!canSelect}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        border: isSelected ? '2px solid #3B82F6' : '1px solid var(--figma-border)',
                        background: !canSelect ? 'var(--figma-card)' : isSelected ? 'rgba(59,130,246,0.2)' : 'var(--figma-card)',
                        color: !canSelect ? '#64748B' : '#fff',
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: canSelect ? 'pointer' : 'default',
                        opacity: !canSelect ? 0.5 : 1,
                        position: 'relative',
                      }}
                    >
                      {slot.start} – {slot.end}
                      {isMultiCourt && !availableOnAll && slot.available && (
                        <span style={{ display: 'block', fontSize: 10, color: '#EF4444', marginTop: 2 }}>
                          Unavailable on some courts
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: 'sticky', bottom: 0, padding: 16, background: 'var(--figma-bg)', borderTop: '1px solid var(--figma-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <span style={{ color: '#94A3B8', fontSize: 14 }}>{hours} hour{hours !== 1 ? 's' : ''} selected</span>
            {isMultiCourt && (
              <span style={{ color: '#64748B', fontSize: 12, display: 'block' }}>
                x {courtCount} courts
              </span>
            )}
          </div>
          <span style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>₹{total}</span>
        </div>
        <button className="figma-btn-primary" style={{ width: '100%' }} disabled={hours === 0} onClick={() => onContinue && onContinue({ selected, subtotal, gst, total, hours, facilities: rawList })}>
          Continue
        </button>
      </div>
    </div>
  );
}
