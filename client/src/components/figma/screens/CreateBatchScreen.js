import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import trainerApi from '../../../services/trainerApi';

const SPORTS = ['Cricket', 'Badminton', 'Football', 'Tennis', 'Basketball', 'Volleyball', 'Pickleball'];
const DAYS = [
  { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 },
];
const FALLBACK_VENUES = [
  { _id: 'v1', name: 'Champions Arena' },
  { _id: 'v2', name: 'Elite Sports Arena' },
  { _id: 'v3', name: 'Phoenix Tennis Club' },
];

const fieldStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid var(--figma-border)', background: 'var(--figma-card)',
  color: '#fff', fontSize: 14, outline: 'none',
};

export function CreateBatchScreen({ onBack, onSave }) {
  const [form, setForm] = useState({
    sport: '', name: '', venueId: '', useCustomVenue: false,
    customVenueName: '', customVenueAddress: '',
    facility: '', capacity: '20', price: '', days: [], startTime: '06:00', endTime: '07:30',
  });
  const [venues, setVenues] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    trainerApi.getMyVenues().then(res => setVenues(res.data)).catch(() => setVenues(FALLBACK_VENUES));
  }, []);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const toggleDay = (d) => setForm(p => ({ ...p, days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d] }));

  const canSave = form.sport && form.name && (form.venueId || (form.useCustomVenue && form.customVenueName)) && form.days.length > 0 && form.price;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError('');

    const payload = {
      name: form.name,
      sport: form.sport,
      capacity: parseInt(form.capacity, 10) || 20,
      sportFees: [{ sport: form.sport, fee: parseFloat(form.price) }],
      schedule: {
        daysOfWeek: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
      },
    };

    if (form.useCustomVenue) {
      payload.location = { address: form.customVenueAddress, city: form.customVenueName };
    } else {
      payload.venue = form.venueId;
    }

    try {
      const res = await trainerApi.createBatch(payload);
      try {
        await trainerApi.generateSessions(res.data._id, 4);
      } catch { /* non-critical */ }
      onSave && onSave(res.data);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Failed to create batch';
      setError(msg);
      onSave && onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="figma-page" style={{ paddingBottom: '6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Create Batch</span>
      </div>

      {error && (
        <div style={{ padding: 12, borderRadius: 12, background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontSize: 14, marginBottom: 16 }}>{error}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Sport</label>
          <select value={form.sport} onChange={set('sport')} style={{ ...fieldStyle, appearance: 'none' }}>
            <option value="">Select sport</option>
            {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Batch Name</label>
          <input type="text" placeholder="e.g. Morning Cricket Coaching" value={form.name} onChange={set('name')} style={fieldStyle} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500 }}>Venue</label>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, useCustomVenue: !p.useCustomVenue, venueId: '' }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B5CF6', fontSize: 12, fontWeight: 600 }}
            >
              {form.useCustomVenue ? 'Select Registered Venue' : '+ Custom Venue'}
            </button>
          </div>
          {form.useCustomVenue ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="text" placeholder="Venue name" value={form.customVenueName} onChange={set('customVenueName')} style={fieldStyle} />
              <input type="text" placeholder="Address" value={form.customVenueAddress} onChange={set('customVenueAddress')} style={fieldStyle} />
            </div>
          ) : (
            <select value={form.venueId} onChange={set('venueId')} style={{ ...fieldStyle, appearance: 'none' }}>
              <option value="">Select venue</option>
              {venues.map(v => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select>
          )}
        </div>

        <div>
          <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Facility (optional)</label>
          <input type="text" placeholder="e.g. Turf 1, Court A" value={form.facility} onChange={set('facility')} style={fieldStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Capacity</label>
            <input type="number" value={form.capacity} onChange={set('capacity')} style={fieldStyle} min="1" />
          </div>
          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Monthly Price (₹)</label>
            <input type="number" placeholder="3000" value={form.price} onChange={set('price')} style={fieldStyle} min="0" />
          </div>
        </div>

        <div>
          <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block' }}>Schedule Days</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DAYS.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: form.days.includes(d.value) ? '#8B5CF6' : 'var(--figma-card)',
                  color: '#fff', fontSize: 13, fontWeight: 600,
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Start Time</label>
            <input type="time" value={form.startTime} onChange={set('startTime')} style={fieldStyle} />
          </div>
          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>End Time</label>
            <input type="time" value={form.endTime} onChange={set('endTime')} style={fieldStyle} />
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!canSave || saving}
        onClick={handleSave}
        style={{
          width: '100%', marginTop: 32, padding: 16, borderRadius: 16, border: 'none', cursor: canSave && !saving ? 'pointer' : 'default',
          background: canSave && !saving ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' : '#334155',
          color: '#fff', fontSize: 16, fontWeight: 700, opacity: canSave && !saving ? 1 : 0.5,
        }}
      >
        {saving ? 'Creating...' : 'Create Batch'}
      </button>
    </div>
  );
}
