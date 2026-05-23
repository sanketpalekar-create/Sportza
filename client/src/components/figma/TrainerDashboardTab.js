import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, IndianRupee, Bell, CheckCircle2, RefreshCw } from 'lucide-react';
import trainerApi from '../../services/trainerApi';

const MOCK_DASHBOARD = {
  activeBatches: 3,
  totalPlayers: 32,
  todaySessions: [
    { _id: '1', batch: { name: 'Morning Cricket Coaching', sport: 'Cricket' }, venue: { name: 'Champions Arena' }, startTime: '06:00', endTime: '07:30', status: 'scheduled' },
    { _id: '2', batch: { name: 'Advanced Badminton', sport: 'Badminton' }, venue: { name: 'Elite Sports Arena' }, startTime: '07:00', endTime: '08:30', status: 'completed' },
  ],
  monthlyRevenue: { totalCollected: 45000, totalCommission: 4500, totalNet: 40500, count: 15 },
  attendanceRate: 89,
  announcements: [
    { _id: '1', message: 'Cricket batch timing changed to 6:30 AM from next Monday', batch: { name: 'Morning Cricket' }, createdAt: '2026-03-09' },
    { _id: '2', message: 'No sessions on March 14 (Holi)', batch: { name: 'All Batches' }, createdAt: '2026-03-05' },
  ],
};

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatCurrency(n) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(0) + 'K';
  return '₹' + n.toLocaleString('en-IN');
}

export function TrainerDashboardTab({ onViewBatch, onMarkAttendance }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await trainerApi.getDashboard();
      setData(res.data);
    } catch {
      setData(MOCK_DASHBOARD);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const d = data || MOCK_DASHBOARD;

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Dashboard</h1>
          <p className="figma-body">Trainer Mode</p>
        </div>
        <button type="button" onClick={fetchDashboard} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#94A3B8' }}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
        <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontSize: 12, fontWeight: 600 }}>
          Trainer Mode
        </div>
      </div>

      <div className="figma-grid2 figma-gap4" style={{ marginBottom: '2rem' }}>
        <div style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)', padding: 16, borderRadius: 16 }}>
          <Calendar size={22} color="#fff" style={{ marginBottom: 8 }} />
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{d.activeBatches}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Active Batches</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <Users size={22} color="#3B82F6" style={{ marginBottom: 8 }} />
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{d.totalPlayers}</div>
          <div className="figma-body">Total Players</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <IndianRupee size={22} color="#22C55E" style={{ marginBottom: 8 }} />
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{formatCurrency(d.monthlyRevenue?.totalNet || 0)}</div>
          <div className="figma-body">This Month</div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <CheckCircle2 size={22} color="#F59E0B" style={{ marginBottom: 8 }} />
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 2 }}>{d.attendanceRate}%</div>
          <div className="figma-body">Attendance</div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 className="figma-heading2" style={{ marginBottom: 12 }}>Today's Sessions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(d.todaySessions || []).length === 0 && (
            <div className="figma-card" style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>No sessions today</div>
          )}
          {(d.todaySessions || []).map((s) => {
            const isCompleted = s.status === 'completed';
            return (
              <div key={s._id} className="figma-card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => onViewBatch && onViewBatch(s)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{s.batch?.name || 'Session'}</div>
                    <div style={{ color: '#94A3B8', fontSize: 13 }}>{s.venue?.name || ''}</div>
                  </div>
                  <span style={{
                    padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: isCompleted ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
                    color: isCompleted ? '#22C55E' : '#3B82F6',
                  }}>{isCompleted ? 'Done' : 'Upcoming'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94A3B8', fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {formatTime(s.startTime)} - {formatTime(s.endTime)}</span>
                  </div>
                  {!isCompleted && (
                    <button type="button" className="figma-btn-primary" style={{ fontSize: 12, height: 32, padding: '0 12px' }} onClick={(e) => { e.stopPropagation(); onMarkAttendance && onMarkAttendance(s); }}>
                      Attendance
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="figma-heading2" style={{ marginBottom: 12 }}>Announcements</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(d.announcements || []).length === 0 && (
            <div className="figma-card" style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>No recent announcements</div>
          )}
          {(d.announcements || []).map((a) => (
            <div key={a._id} className="figma-card" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bell size={18} color="#F59E0B" />
              </div>
              <div>
                <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.4 }}>{a.message}</div>
                <div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>{a.batch?.name} &bull; {new Date(a.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
