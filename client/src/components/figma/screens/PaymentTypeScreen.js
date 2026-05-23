import React, { useState } from 'react';
import { ChevronLeft, UserPlus, Divide, Trash2 } from 'lucide-react';

export function PaymentTypeScreen({ total, onBack, onContinue }) {
  const [mode, setMode] = useState('full');
  const [players, setPlayers] = useState([{ id: 'you', name: 'You', amount: total || 0 }]);
  const sum = players.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const valid = Math.abs(sum - (total || 0)) < 1;

  const addPlayer = () => {
    setPlayers((prev) => [...prev, { id: 'p' + Date.now(), name: 'Player ' + prev.length, amount: 0 }]);
  };

  const removePlayer = (id) => {
    if (players.length <= 1) return;
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const splitEqually = () => {
    const count = players.length;
    if (count === 0) return;
    const perPerson = Math.floor((total || 0) / count);
    const remainder = (total || 0) - perPerson * count;
    setPlayers((prev) => prev.map((p, i) => ({ ...p, amount: perPerson + (i === 0 ? remainder : 0) })));
  };

  const setAmount = (id, amount) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, amount: Number(amount) || 0 } : p)));
  };

  const setName = (id, name) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Payment</span>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('full')} style={{ flex: 1, padding: 12, borderRadius: 12, border: mode === 'full' ? '2px solid #3B82F6' : '1px solid var(--figma-border)', background: mode === 'full' ? 'rgba(59,130,246,0.15)' : 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Pay Full</button>
          <button onClick={() => setMode('split')} style={{ flex: 1, padding: 12, borderRadius: 12, border: mode === 'split' ? '2px solid #3B82F6' : '1px solid var(--figma-border)', background: mode === 'split' ? 'rgba(59,130,246,0.15)' : 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Split</button>
        </div>
      </div>

      {mode === 'split' && (
        <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="figma-body">Split amount (Total ₹{total})</div>
            <button
              type="button"
              onClick={splitEqually}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 13, fontWeight: 600,
              }}
            >
              <Divide size={14} /> Split Equally
            </button>
          </div>
          {players.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{p.name.slice(0, 1).toUpperCase()}</div>
              <input
                type="text"
                value={p.name}
                onChange={(e) => setName(p.id, e.target.value)}
                style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--figma-border)', background: 'var(--figma-card)', color: '#fff', fontSize: 14 }}
              />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: 8, color: '#94A3B8', fontSize: 13, pointerEvents: 'none' }}>₹</span>
                <input type="number" value={p.amount} onChange={(e) => setAmount(p.id, e.target.value)} style={{ width: 80, padding: '8px 8px 8px 22px', borderRadius: 8, border: '1px solid var(--figma-border)', background: 'var(--figma-card)', color: '#fff', fontSize: 14 }} />
              </div>
              {players.length > 1 && (
                <button type="button" onClick={() => removePlayer(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#EF4444' }}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <button onClick={addPlayer} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, background: 'none', border: '1px dashed var(--figma-border)', borderRadius: 12, color: '#94A3B8', fontSize: 14, cursor: 'pointer', width: '100%' }}>
            <UserPlus size={18} /> Add player
          </button>
          {!valid && sum > 0 && (
            <p style={{ color: sum > (total || 0) ? '#EF4444' : '#F59E0B', fontSize: 12, marginTop: 10 }}>
              Sum is ₹{sum} — {sum > (total || 0) ? 'exceeds' : 'does not match'} total ₹{total}
            </p>
          )}
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, paddingTop: 16, background: 'var(--figma-bg)' }}>
        <button className="figma-btn-primary" style={{ width: '100%' }} disabled={mode === 'split' && !valid} onClick={() => onContinue && onContinue({ mode, players: mode === 'split' ? players : undefined })}>Continue to payment</button>
      </div>
    </div>
  );
}
