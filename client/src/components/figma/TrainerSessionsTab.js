import React, { useState, useEffect } from 'react';
import { Clock, Users, Calendar, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import trainerApi from '../../services/trainerApi';

const MOCK_SESSIONS = [
  { _id: '1', batch: { _id: 'b1', name: 'Morning Cricket Coaching' }, date: '2026-03-11', startTime: '06:00', endTime: '07:30', status: 'scheduled' },
  { _id: '2', batch: { _id: 'b2', name: 'Advanced Badminton' }, date: '2026-03-11', startTime: '07:00', endTime: '08:30', status: 'scheduled' },
  { _id: '3', batch: { _id: 'b1', name: 'Morning Cricket Coaching' }, date: '2026-03-10', startTime: '06:00', endTime: '07:30', status: 'completed' },
  { _id: '4', batch: { _id: 'b3', name: 'Weekend Football Camp' }, date: '2026-03-09', startTime: '17:00', endTime: '18:30', status: 'completed' },
  { _id: '5', batch: { _id: 'b2', name: 'Advanced Badminton' }, date: '2026-03-08', startTime: '07:00', endTime: '08:30', status: 'cancelled' },
];

const STATUS_CONFIG = {
  scheduled: { label: 'Upcoming', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: Calendar },
  completed: { label: 'Completed', color: '#22C55E', bg: 'rgba(34,197,94,0.15)', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', icon: XCircle },
};

const FILTER_OPTIONS = ['All', 'Upcoming', 'Completed', 'Cancelled'];
const FILTER_MAP = { Upcoming: 'scheduled', Completed: 'completed', Cancelled: 'cancelled' };

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} (${days[date.getDay()]})`;
}

export function TrainerSessionsTab({ onMarkAttendance }) {
  const [filter, setFilter] = useState('All');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAllSessions = async () => {
    setLoading(true);
    try {
      const batchesRes = await trainerApi.getBatches();
      const batchIds = batchesRes.data.map(b => b._id);
      const sessionPromises = batchIds.map(id => trainerApi.getSessions(id));
      const results = await Promise.all(sessionPromises);
      const allSessions = results.flatMap((res, i) =>
        res.data.map(s => ({ ...s, batch: { _id: batchIds[i], name: batchesRes.data[i].name } }))
      );
      allSessions.sort((a, b) => new Date(b.date) - new Date(a.date));
      setSessions(allSessions);
    } catch {
      setSessions(MOCK_SESSIONS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllSessions(); }, []);

  const filtered = filter === 'All'
    ? sessions
    : sessions.filter(s => s.status === FILTER_MAP[filter]);

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Sessions</h1>
          <p className="figma-body">All scheduled sessions</p>
        </div>
        <button type="button" onClick={fetchAllSessions} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#94A3B8' }}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
        <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontSize: 12, fontWeight: 600 }}>
          Trainer Mode
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: 4 }}>
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', background: filter === f ? '#8B5CF6' : 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 500 }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && sessions.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Loading sessions...</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((s) => {
          const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
          const StatusIcon = cfg.icon;
          return (
            <div key={s._id} className="figma-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{s.batch?.name || 'Session'}</div>
                  <div style={{ color: '#94A3B8', fontSize: 13 }}>{formatDate(s.date)}</div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <StatusIcon size={12} /> {cfg.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94A3B8', fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {formatTime(s.startTime)} - {formatTime(s.endTime)}</span>
                </div>
                {s.status === 'scheduled' && (
                  <button type="button" className="figma-btn-primary" style={{ fontSize: 12, height: 32, padding: '0 12px' }} onClick={() => onMarkAttendance && onMarkAttendance(s)}>
                    Attendance
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 14 }}>No sessions match this filter.</div>
        )}
      </div>
    </div>
  );
}
