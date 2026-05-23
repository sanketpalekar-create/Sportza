import React, { useState } from 'react';
import { ChevronLeft, MapPin, Calendar, Clock, Users, UserPlus, Pencil, Trash2 } from 'lucide-react';

const MOCK_PLAYERS = [
  { id: '1', name: 'You', isHost: true },
  { id: '2', name: 'Rahul K.', isHost: false },
  { id: '3', name: 'Priya S.', isHost: false },
  { id: '4', name: 'Arjun P.', isHost: false },
  { id: '5', name: 'Meera N.', isHost: false },
];

export function ManageSessionScreen({ session, onBack, onViewPlayers, onSaveEdit, onCancelSession }) {
  const s = session || {};
  const title = s.title || s.venue || 'Open Play';
  const [editing, setEditing] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(s.maxPlayers ?? 8);
  const [notes, setNotes] = useState(s.notes || '');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const currentCount = MOCK_PLAYERS.length;
  const handleSave = () => {
    onSaveEdit && onSaveEdit({ maxPlayers, notes });
    setEditing(false);
  };

  const handleCancelSession = () => {
    onCancelSession && onCancelSession();
    setShowCancelConfirm(false);
    onBack();
  };

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Manage session</span>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>{title}</h2>
          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 12, fontWeight: 500 }}>{s.sport || 'Sport'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 11, fontWeight: 500 }}>You host</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14, marginBottom: 6 }}>
          <MapPin size={14} /> {s.location || 'Venue'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14, marginBottom: 6 }}>
          <Calendar size={14} /> {s.date || 'Date'} · <Clock size={14} /> {s.time || 'Time'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14 }}>
          <Users size={14} /> {currentCount}/{maxPlayers} players
        </div>
      </div>

      <button
        type="button"
        className="figma-btn-ghost"
        style={{ width: '100%', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        onClick={() => onViewPlayers && onViewPlayers()}
      >
        <UserPlus size={18} /> View players
      </button>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Session details</span>
          {!editing ? (
            <button type="button" className="figma-btn-ghost" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setEditing(true)}>
              <Pencil size={14} /> Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="figma-btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setEditing(false)}>Cancel</button>
              <button type="button" className="figma-btn-primary" style={{ padding: '6px 12px' }} onClick={handleSave}>Save</button>
            </div>
          )}
        </div>
        {editing ? (
          <div>
            <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>Max players</label>
            <input
              type="number"
              min={currentCount}
              max={20}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value) || maxPlayers)}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--figma-border)', background: 'var(--figma-bg)', color: '#fff', marginBottom: 16 }}
            />
            <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Bring your own racket"
              rows={3}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid var(--figma-border)', background: 'var(--figma-bg)', color: '#fff', resize: 'vertical' }}
            />
          </div>
        ) : (
          <div>
            <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 4 }}>Max players: {maxPlayers}</div>
            {notes ? <div style={{ color: '#94A3B8', fontSize: 14 }}>Notes: {notes}</div> : null}
          </div>
        )}
      </div>

      {!showCancelConfirm ? (
        <button
          type="button"
          style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onClick={() => setShowCancelConfirm(true)}
        >
          <Trash2 size={18} /> Cancel session
        </button>
      ) : (
        <div className="figma-card" style={{ padding: 16, marginBottom: 16, borderColor: 'rgba(239,68,68,0.3)' }}>
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Cancel this session?</div>
          <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 16 }}>Joined players will be notified. This cannot be undone.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" className="figma-btn-ghost" style={{ flex: 1 }} onClick={() => setShowCancelConfirm(false)}>Keep session</button>
            <button type="button" style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={handleCancelSession}>Yes, cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
