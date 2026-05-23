import React, { useState, useEffect } from 'react';
import { Plus, Users, Calendar, MapPin, ChevronRight, RefreshCw } from 'lucide-react';
import trainerApi from '../../services/trainerApi';

const MOCK_BATCHES = [
  { _id: '1', name: 'Morning Cricket Coaching', sport: 'Cricket', venue: { name: 'Champions Arena' }, players: Array(12), capacity: 20, schedule: { daysOfWeek: [1, 3, 5], startTime: '06:00', endTime: '07:30' }, isActive: true, sportFees: [{ sport: 'Cricket', fee: 3000 }] },
  { _id: '2', name: 'Advanced Badminton', sport: 'Badminton', venue: { name: 'Elite Sports Arena' }, players: Array(8), capacity: 12, schedule: { daysOfWeek: [2, 4], startTime: '07:00', endTime: '08:30' }, isActive: true, sportFees: [{ sport: 'Badminton', fee: 4500 }] },
  { _id: '3', name: 'Weekend Football Camp', sport: 'Football', venue: { name: 'Phoenix Ground' }, players: Array(15), capacity: 24, schedule: { daysOfWeek: [6, 0], startTime: '17:00', endTime: '18:30' }, isActive: true, sportFees: [{ sport: 'Football', fee: 2500 }] },
];

const sportIcons = { Cricket: '🏏', Badminton: '🏸', Football: '⚽', Tennis: '🎾', Basketball: '🏀', Volleyball: '🏐' };
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatSchedule(schedule) {
  if (!schedule?.daysOfWeek?.length) return 'No schedule';
  const days = schedule.daysOfWeek.map(d => DAY_SHORT[d]).join(', ');
  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  };
  return `${days} • ${formatTime(schedule.startTime)}`;
}

function getPrice(batch) {
  const fee = batch.sportFees?.[0]?.fee || batch.feeSchedules?.[0]?.fee;
  return fee ? `₹${fee.toLocaleString('en-IN')}/mo` : '';
}

export function TrainerBatchesTab({ onViewBatch, onCreateBatch }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const res = await trainerApi.getBatches();
      setBatches(res.data);
    } catch {
      setBatches(MOCK_BATCHES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBatches(); }, []);

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>My Batches</h1>
          <p className="figma-body">Manage your training batches</p>
        </div>
        <button type="button" onClick={fetchBatches} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#94A3B8' }}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
        <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontSize: 12, fontWeight: 600 }}>
          Trainer Mode
        </div>
      </div>

      <button
        type="button"
        onClick={() => onCreateBatch && onCreateBatch()}
        style={{ width: '100%', background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: 'none', cursor: 'pointer', marginBottom: '1.5rem', color: '#fff', fontSize: 16, fontWeight: 600 }}
      >
        <Plus size={20} /> Create New Batch
      </button>

      {loading && batches.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading batches...</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {batches.map((batch) => {
          const playerCount = batch.playerCount ?? batch.players?.length ?? 0;
          return (
            <div key={batch._id} className="figma-card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => onViewBatch && onViewBatch(batch)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onViewBatch && onViewBatch(batch)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 28 }}>{sportIcons[batch.sport] || '🏅'}</span>
                  <div>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{batch.name}</div>
                    <span style={{ padding: '3px 8px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 11, fontWeight: 500 }}>{batch.sport}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: batch.isActive ? '#22C55E' : '#64748B' }} />
                  <span style={{ color: batch.isActive ? '#22C55E' : '#64748B', fontSize: 12, fontWeight: 500 }}>{batch.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>
                <MapPin size={13} /> {batch.venue?.name || batch.location?.address || 'No venue'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {formatSchedule(batch.schedule)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 13 }}>
                  <Users size={14} /> {playerCount}/{batch.capacity || '∞'} players
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#3B82F6', fontSize: 14, fontWeight: 700 }}>{getPrice(batch)}</span>
                  <ChevronRight size={18} color="#64748B" />
                </div>
              </div>
            </div>
          );
        })}
        {!loading && batches.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
            <div style={{ fontSize: 16, marginBottom: 8 }}>No batches yet</div>
            <div style={{ fontSize: 13 }}>Create your first training batch to get started</div>
          </div>
        )}
      </div>
    </div>
  );
}
