import React, { useState } from 'react';
import { ChevronLeft, UserPlus, MapPin, Calendar, Clock, Users, Check } from 'lucide-react';

const SPORTS = ['Football', 'Badminton', 'Cricket', 'Tennis', 'Basketball', 'Pickleball'];
const VENUES = [
  { id: 1, name: 'Elite Sports Arena', location: 'Koregaon Park' },
  { id: 2, name: 'Phoenix Tennis Club', location: 'Baner' },
  { id: 3, name: 'Champions Football Arena', location: 'Hinjewadi' },
  { id: 4, name: 'Hoops Basketball Court', location: 'Viman Nagar' },
];
const SKILL_LEVELS = ['All levels', 'Beginner', 'Intermediate', 'Advanced'];

const fieldStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid var(--figma-border)', background: 'var(--figma-card)',
  color: '#fff', fontSize: 14, outline: 'none',
};

export function CreateOpenPlayScreen({ onBack, onPublish }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    sport: '', venue: '', date: '', startTime: '', endTime: '',
    maxPlayers: '10', skillLevel: 'All levels', description: '', price: 'Free',
  });
  const [published, setPublished] = useState(false);

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const canContinue1 = form.sport && form.venue;
  const canContinue2 = form.date && form.startTime && form.endTime;
  const canPublish = canContinue1 && canContinue2;

  const selectedVenue = VENUES.find((v) => v.name === form.venue);

  const handlePublish = () => {
    setPublished(true);
    onPublish && onPublish(form);
  };

  if (published) {
    return (
      <div className="figma-page" style={{ paddingBottom: '5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Check size={36} color="#22C55E" />
        </div>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Session Published!</h2>
        <p style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center', maxWidth: 280, marginBottom: 24 }}>
          Your {form.sport} open play session at {form.venue} is now live. Other players can find and join it.
        </p>
        <div className="figma-card" style={{ padding: 16, width: '100%', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Sport</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{form.sport}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Venue</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{form.venue}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Date</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{form.date}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Time</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{form.startTime} - {form.endTime}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Max Players</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{form.maxPlayers}</span>
          </div>
        </div>
        <button type="button" className="figma-btn-primary" style={{ width: '100%' }} onClick={onBack}>
          Back to Open Play
        </button>
      </div>
    );
  }

  return (
    <div className="figma-page" style={{ paddingBottom: '6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Host a Session</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: step >= s ? '#3B82F6' : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Choose Sport & Venue</h3>

          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block' }}>Sport</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SPORTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, sport: s }))}
                  style={{
                    padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: form.sport === s ? '#3B82F6' : 'var(--figma-card)',
                    color: '#fff', fontSize: 14, fontWeight: 500,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block' }}>Venue</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {VENUES.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, venue: v.name }))}
                  style={{
                    padding: 14, borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                    background: form.venue === v.name ? 'rgba(59,130,246,0.15)' : 'var(--figma-card)',
                    border: form.venue === v.name ? '2px solid #3B82F6' : '2px solid transparent',
                  }}
                >
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{v.name}</div>
                  <div style={{ color: '#94A3B8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} /> {v.location}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={!canContinue1}
            onClick={() => setStep(2)}
            style={{
              width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: canContinue1 ? 'pointer' : 'default',
              background: canContinue1 ? '#3B82F6' : '#334155', color: '#fff', fontSize: 16, fontWeight: 600,
              opacity: canContinue1 ? 1 : 0.5,
            }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Schedule & Format</h3>

          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Date</label>
            <input type="date" value={form.date} onChange={set('date')} style={fieldStyle} />
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

          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Max Players</label>
            <input type="number" min="2" max="50" value={form.maxPlayers} onChange={set('maxPlayers')} style={fieldStyle} />
          </div>

          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block' }}>Skill Level</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {SKILL_LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, skillLevel: l }))}
                  style={{
                    padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: form.skillLevel === l ? '#3B82F6' : 'var(--figma-card)',
                    color: '#fff', fontSize: 13, fontWeight: 500,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="figma-btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
            <button
              type="button"
              disabled={!canContinue2}
              onClick={() => setStep(3)}
              style={{
                flex: 2, padding: 14, borderRadius: 14, border: 'none', cursor: canContinue2 ? 'pointer' : 'default',
                background: canContinue2 ? '#3B82F6' : '#334155', color: '#fff', fontSize: 16, fontWeight: 600,
                opacity: canContinue2 ? 1 : 0.5,
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Review & Publish</h3>

          <div className="figma-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 13, fontWeight: 600 }}>{form.sport}</span>
              <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 13, fontWeight: 600 }}>{form.skillLevel}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: '#fff', fontSize: 15, fontWeight: 600 }}>
              <MapPin size={16} color="#94A3B8" /> {form.venue}
            </div>
            {selectedVenue && (
              <div style={{ color: '#64748B', fontSize: 13, marginBottom: 10, paddingLeft: 24 }}>{selectedVenue.location}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#94A3B8', fontSize: 14 }}>
              <Calendar size={15} /> {form.date}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#94A3B8', fontSize: 14 }}>
              <Clock size={15} /> {form.startTime} - {form.endTime}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#94A3B8', fontSize: 14 }}>
              <Users size={15} /> Max {form.maxPlayers} players
            </div>
          </div>

          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Description (optional)</label>
            <textarea
              placeholder="Add any details for players joining your session..."
              value={form.description}
              onChange={set('description')}
              rows={3}
              style={{ ...fieldStyle, resize: 'none' }}
            />
          </div>

          <div>
            <label style={{ color: '#94A3B8', fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block' }}>Entry Fee</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Free', 'Paid'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, price: opt === 'Free' ? 'Free' : p.price === 'Free' ? '' : p.price }))}
                  style={{
                    padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: (form.price === 'Free' ? 'Free' : 'Paid') === opt ? '#3B82F6' : 'var(--figma-card)',
                    color: '#fff', fontSize: 14, fontWeight: 500,
                  }}
                >
                  {opt}
                </button>
              ))}
              {form.price !== 'Free' && (
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                  <span style={{ position: 'absolute', left: 12, color: '#94A3B8', fontSize: 14, pointerEvents: 'none' }}>₹</span>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={form.price === 'Free' ? '' : form.price}
                    onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                    style={{ ...fieldStyle, paddingLeft: 28 }}
                  />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="figma-btn-ghost" style={{ flex: 1 }} onClick={() => setStep(2)}>Back</button>
            <button
              type="button"
              disabled={!canPublish}
              onClick={handlePublish}
              style={{
                flex: 2, padding: 14, borderRadius: 14, border: 'none', cursor: canPublish ? 'pointer' : 'default',
                background: canPublish ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' : '#334155',
                color: '#fff', fontSize: 16, fontWeight: 700, opacity: canPublish ? 1 : 0.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <UserPlus size={18} /> Publish Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
