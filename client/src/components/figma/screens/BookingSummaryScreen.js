import React, { useState } from 'react';
import { ChevronLeft, Plus, Minus } from 'lucide-react';

const ADDONS = [
  { id: '1', name: 'Energy Drink', price: 50, icon: '⚡' },
  { id: '2', name: 'Ball Rental', price: 100, icon: '🏐' },
  { id: '3', name: 'Equipment', price: 200, icon: '🎽' },
  { id: '4', name: 'Towel', price: 30, icon: '🧺' },
  { id: '5', name: 'Water Bottle', price: 20, icon: '💧' },
];

export function BookingSummaryScreen({ booking, onBack, onContinue }) {
  const [addonQty, setAddonQty] = useState({});
  const b = booking || {};
  const venue = b.venue;
  const facility = b.facility;
  const rawFacilities = b.facilities || (facility ? [facility] : []);
  const facilities = rawFacilities.map((f) => typeof f === 'string' ? { name: f, surfaceType: null } : f);
  const isMultiCourt = facilities.length > 1;
  const date = b.date;
  const timeRange = b.timeRange;
  const hours = b.hours;
  const subtotal = b.subtotal || 0;
  const gst = b.gst || 0;
  const baseTotal = b.total || 0;
  const pricePerHour = venue?.pricePerHour || 800;
  const perCourtSubtotal = hours * pricePerHour;

  const addonsTotal = ADDONS.reduce((sum, a) => sum + (addonQty[a.id] || 0) * a.price, 0);
  const total = baseTotal + addonsTotal;

  const activeAddons = ADDONS.filter((a) => (addonQty[a.id] || 0) > 0);

  function increment(id) {
    setAddonQty((prev) => ({ ...prev, [id]: Math.min((prev[id] || 0) + 1, 10) }));
  }

  function decrement(id) {
    setAddonQty((prev) => {
      const next = (prev[id] || 0) - 1;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  }

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Booking Summary</span>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="figma-body" style={{ marginBottom: 8 }}>Booking details</div>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{venue ? venue.name : ''}</div>
        {isMultiCourt ? (
          <>
            <div style={{ color: '#94A3B8', fontSize: 14 }}>{(venue && venue.sport) || 'Badminton'} · {facilities.length} courts</div>
            <div style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>
              {facilities.map((f) => f.surfaceType ? `${f.name} (${f.surfaceType})` : f.name).join(', ')}
            </div>
          </>
        ) : (
          <>
            <div style={{ color: '#94A3B8', fontSize: 14 }}>{(venue && venue.sport) || 'Badminton'} · {facilities[0]?.name || facility}</div>
            {facilities[0]?.surfaceType && (
              <div style={{ color: '#60A5FA', fontSize: 13, marginTop: 4 }}>
                Surface: {facilities[0].surfaceType}
              </div>
            )}
          </>
        )}
        <div style={{ color: '#94A3B8', fontSize: 14, marginTop: 4 }}>{date} · {timeRange}</div>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <div className="figma-body" style={{ marginBottom: 12 }}>Price breakdown</div>

        {isMultiCourt ? (
          <>
            {facilities.map((f) => (
              <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#94A3B8' }}>
                <span>{f.name}{f.surfaceType ? ` · ${f.surfaceType}` : ''} ({hours} hr{hours !== 1 ? 's' : ''} x ₹{pricePerHour})</span>
                <span>₹{perCourtSubtotal}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--figma-border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#94A3B8' }}>
              <span>Combined subtotal</span>
              <span>₹{subtotal}</span>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#94A3B8' }}>
            <span>Subtotal ({hours} hr{hours !== 1 ? 's' : ''})</span>
            <span>₹{subtotal}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#94A3B8' }}>
          <span>GST (18%)</span>
          <span>₹{gst}</span>
        </div>
        {activeAddons.map((a) => (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14, color: '#94A3B8' }}>
            <span>{a.name} x{addonQty[a.id]}</span>
            <span>₹{addonQty[a.id] * a.price}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--figma-border)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="figma-heading2" style={{ margin: 0 }}>Total</span>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>₹{total}</span>
        </div>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 24 }}>
        <div className="figma-body" style={{ marginBottom: 12 }}>Add-ons (optional)</div>
        {ADDONS.map((a) => {
          const qty = addonQty[a.id] || 0;
          return (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--figma-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                <div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ color: '#64748B', fontSize: 12 }}>₹{a.price} each</div>
                </div>
              </div>
              {qty === 0 ? (
                <button
                  type="button"
                  onClick={() => increment(a.id)}
                  style={{
                    padding: '6px 16px', borderRadius: 10,
                    border: '1px solid rgba(59,130,246,0.3)',
                    background: 'rgba(59,130,246,0.08)',
                    color: '#3B82F6', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Plus size={14} /> Add
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderRadius: 10, border: '1px solid rgba(59,130,246,0.3)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => decrement(a.id)}
                    style={{
                      width: 36, height: 36,
                      border: 'none', cursor: 'pointer',
                      background: 'rgba(59,130,246,0.08)',
                      color: '#3B82F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Minus size={16} />
                  </button>
                  <div style={{
                    width: 36, height: 36,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 15, fontWeight: 700,
                    background: 'rgba(59,130,246,0.15)',
                  }}>
                    {qty}
                  </div>
                  <button
                    type="button"
                    onClick={() => increment(a.id)}
                    style={{
                      width: 36, height: 36,
                      border: 'none', cursor: 'pointer',
                      background: 'rgba(59,130,246,0.08)',
                      color: '#3B82F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ position: 'sticky', bottom: 0, paddingTop: 16, background: 'var(--figma-bg)' }}>
        <button className="figma-btn-primary" style={{ width: '100%' }} onClick={() => onContinue && onContinue({ ...booking, addonQty, addonsTotal, total, facilities: rawFacilities })}>Continue</button>
      </div>
    </div>
  );
}
