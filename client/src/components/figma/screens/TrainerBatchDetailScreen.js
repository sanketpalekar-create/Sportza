import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Clock, CheckCircle2, XCircle, Plus, Trash2, Send } from 'lucide-react';
import trainerApi from '../../../services/trainerApi';

const TABS = ['Players', 'Sessions', 'Attendance', 'Payments', 'Announcements'];

const STATUS_BADGE = {
  paid: { color: '#22C55E', bg: 'rgba(34,197,94,0.15)', label: 'Paid' },
  pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: 'Pending' },
  overdue: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)', label: 'Overdue' },
};

const SESSION_STATUS = {
  scheduled: { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', label: 'Upcoming' },
  completed: { color: '#22C55E', bg: 'rgba(34,197,94,0.15)', label: 'Completed' },
  cancelled: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)', label: 'Cancelled' },
};

const sportIcons = { Cricket: '🏏', Badminton: '🏸', Football: '⚽', Tennis: '🎾', Basketball: '🏀', Volleyball: '🏐' };

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

const fmt = (n) => '₹' + (n || 0).toLocaleString('en-IN');

export function TrainerBatchDetailScreen({ batch, onBack }) {
  const [activeTab, setActiveTab] = useState('Players');
  const [batchData, setBatchData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [selectedSession, setSelectedSession] = useState(null);
  const [announcementText, setAnnouncementText] = useState('');
  const [saving, setSaving] = useState(false);

  const batchId = batch?._id;
  const b = batchData || batch || { name: 'Training Batch', sport: 'Cricket', venue: { name: 'Venue' } };

  const fetchBatchData = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await trainerApi.getBatch(batchId);
      setBatchData(res.data);
      setPlayers((res.data.players || []).map(p => ({
        ...p,
        paymentStatus: p.paymentStatus || 'pending',
        joinDate: p.joinDate || p.createdAt,
      })));
    } catch {
      setPlayers([
        { _id: '1', name: 'Arjun Patel', joinDate: '2026-01-15', paymentStatus: 'paid' },
        { _id: '2', name: 'Sneha Gupta', joinDate: '2026-01-20', paymentStatus: 'paid' },
        { _id: '3', name: 'Vikram Singh', joinDate: '2026-02-01', paymentStatus: 'pending' },
        { _id: '4', name: 'Priya Verma', joinDate: '2026-02-10', paymentStatus: 'paid' },
        { _id: '5', name: 'Rahul Desai', joinDate: '2026-02-15', paymentStatus: 'overdue' },
      ]);
    }
  }, [batchId]);

  const fetchSessions = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await trainerApi.getSessions(batchId);
      setSessions(res.data);
    } catch {
      setSessions([
        { _id: '1', date: '2026-03-12', startTime: '06:00', endTime: '07:30', status: 'scheduled' },
        { _id: '2', date: '2026-03-10', startTime: '06:00', endTime: '07:30', status: 'completed' },
        { _id: '3', date: '2026-03-08', startTime: '06:00', endTime: '07:30', status: 'completed' },
      ]);
    }
  }, [batchId]);

  const fetchPayments = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await trainerApi.getPayments(batchId);
      setPayments(res.data);
    } catch {
      setPayments([
        { _id: '1', player: { name: 'Arjun Patel' }, amount: 3000, status: 'completed', paymentMode: 'online', createdAt: '2026-03-05' },
        { _id: '2', player: { name: 'Sneha Gupta' }, amount: 3000, status: 'completed', paymentMode: 'offline', createdAt: '2026-03-03' },
        { _id: '3', player: { name: 'Vikram Singh' }, amount: 3000, status: 'pending' },
      ]);
    }
  }, [batchId]);

  const fetchAnnouncements = useCallback(async () => {
    if (!batchId) return;
    try {
      const res = await trainerApi.getAnnouncements(batchId);
      setAnnouncements(res.data);
    } catch {
      setAnnouncements([
        { _id: '1', message: 'No session on March 14 due to Holi. Extra session on March 16.', createdAt: '2026-03-09' },
        { _id: '2', message: 'Please bring your own kits from next week.', createdAt: '2026-03-03' },
      ]);
    }
  }, [batchId]);

  useEffect(() => {
    fetchBatchData();
    fetchSessions();
    fetchPayments();
    fetchAnnouncements();
  }, [fetchBatchData, fetchSessions, fetchPayments, fetchAnnouncements]);

  const handleRemovePlayer = async (playerId) => {
    if (!batchId) return;
    try {
      await trainerApi.removePlayer(batchId, playerId);
      setPlayers(prev => prev.filter(p => p._id !== playerId));
    } catch { /* mock fallback */ }
  };

  const handleSessionAction = async (sessionId, status) => {
    try {
      await trainerApi.updateSession(sessionId, { status });
      setSessions(prev => prev.map(s => s._id === sessionId ? { ...s, status } : s));
    } catch { /* mock fallback */ }
  };

  const handleSaveAttendance = async () => {
    if (!selectedSession) return;
    setSaving(true);
    const records = players.map(p => ({
      player: p._id,
      status: attendance[p._id] ? 'present' : 'absent'
    }));
    try {
      await trainerApi.markAttendance(selectedSession._id, records);
    } catch { /* mock fallback */ }
    setSaving(false);
  };

  const handlePostAnnouncement = async () => {
    if (!announcementText.trim() || !batchId) return;
    setSaving(true);
    try {
      const res = await trainerApi.postAnnouncement(batchId, announcementText.trim());
      setAnnouncements(prev => [res.data, ...prev]);
    } catch {
      setAnnouncements(prev => [{ _id: Date.now(), message: announcementText.trim(), createdAt: new Date().toISOString() }, ...prev]);
    }
    setAnnouncementText('');
    setSaving(false);
  };

  const toggleAttendance = (playerId) => setAttendance(prev => ({ ...prev, [playerId]: !prev[playerId] }));
  const markAllPresent = () => {
    const all = {};
    players.forEach(p => { all[p._id] = true; });
    setAttendance(all);
  };

  const renderPlayers = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: '#94A3B8', fontSize: 13 }}>{players.length} players enrolled</span>
        <button type="button" className="figma-btn-primary" style={{ fontSize: 12, height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Plus size={14} /> Add Player
        </button>
      </div>
      <div className="figma-card" style={{ overflow: 'hidden' }}>
        {players.map((p, i) => {
          const s = STATUS_BADGE[p.paymentStatus] || STATUS_BADGE.pending;
          const initials = (p.name || '').split(' ').map(n => n[0]).join('');
          return (
            <div key={p._id} style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < players.length - 1 ? '1px solid var(--figma-border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', fontSize: 13, fontWeight: 600 }}>
                  {initials}
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ color: '#64748B', fontSize: 12 }}>Joined {p.joinDate ? new Date(p.joinDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ padding: '3px 8px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 600 }}>{s.label}</span>
                <button type="button" onClick={() => handleRemovePlayer(p._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <Trash2 size={16} color="#EF4444" />
                </button>
              </div>
            </div>
          );
        })}
        {players.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>No players enrolled yet</div>}
      </div>
    </div>
  );

  const renderSessions = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {sessions.map(s => {
        const cfg = SESSION_STATUS[s.status] || SESSION_STATUS.scheduled;
        return (
          <div key={s._id} className="figma-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>{formatDate(s.date)}</div>
                <div style={{ color: '#94A3B8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Clock size={13} /> {formatTime(s.startTime)} - {formatTime(s.endTime)}
                </div>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600 }}>{cfg.label}</span>
            </div>
            {s.status === 'scheduled' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="figma-btn-primary" style={{ flex: 1, fontSize: 12, height: 32 }} onClick={() => handleSessionAction(s._id, 'completed')}>Mark Completed</button>
                <button type="button" style={{ flex: 1, fontSize: 12, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontWeight: 600 }} onClick={() => handleSessionAction(s._id, 'cancelled')}>Cancel</button>
              </div>
            )}
          </div>
        );
      })}
      {sessions.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>No sessions. Generate sessions from batch schedule.</div>}
    </div>
  );

  const renderAttendance = () => {
    const scheduledSessions = sessions.filter(s => s.status === 'scheduled');
    const sess = selectedSession || (scheduledSessions.length > 0 ? scheduledSessions[0] : null);
    return (
      <div>
        {scheduledSessions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#94A3B8', fontSize: 13, marginBottom: 6, display: 'block' }}>Select Session</label>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
              {scheduledSessions.map(s => (
                <button key={s._id} type="button" onClick={() => setSelectedSession(s)} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: (sess && sess._id === s._id) ? '#8B5CF6' : 'var(--figma-card)', color: '#fff', fontSize: 13, fontWeight: 500 }}>
                  {formatDate(s.date)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="figma-card" style={{ overflow: 'hidden', marginBottom: 16 }}>
          {players.map((p, i) => {
            const initials = (p.name || '').split(' ').map(n => n[0]).join('');
            return (
              <div key={p._id} style={{ padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < players.length - 1 ? '1px solid var(--figma-border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', fontSize: 13, fontWeight: 600 }}>
                    {initials}
                  </div>
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{p.name}</span>
                </div>
                <button type="button" onClick={() => toggleAttendance(p._id)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: attendance[p._id] ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.15)' }}>
                  {attendance[p._id] ? <CheckCircle2 size={20} color="#22C55E" /> : <XCircle size={20} color="#EF4444" />}
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="figma-btn-ghost" style={{ flex: 1 }} onClick={markAllPresent}>Mark All Present</button>
          <button type="button" className="figma-btn-primary" style={{ flex: 1 }} onClick={handleSaveAttendance} disabled={saving}>{saving ? 'Saving...' : 'Save Attendance'}</button>
        </div>
      </div>
    );
  };

  const renderPayments = () => {
    const collected = payments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
    const pending = payments.filter(p => p.status !== 'completed').reduce((s, p) => s + p.amount, 0);
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div className="figma-card" style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 4 }}>Expected</div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{fmt(collected + pending)}</div>
          </div>
          <div className="figma-card" style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 4 }}>Collected</div>
            <div style={{ color: '#22C55E', fontSize: 16, fontWeight: 700 }}>{fmt(collected)}</div>
          </div>
          <div className="figma-card" style={{ padding: 12, textAlign: 'center' }}>
            <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 4 }}>Pending</div>
            <div style={{ color: '#EF4444', fontSize: 16, fontWeight: 700 }}>{fmt(pending)}</div>
          </div>
        </div>
        <div className="figma-card" style={{ overflow: 'hidden', marginBottom: 16 }}>
          {payments.map((p, i) => {
            const playerName = p.player?.name || p.payer?.name || 'Unknown';
            const isPaid = p.status === 'completed';
            return (
              <div key={p._id} style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < payments.length - 1 ? '1px solid var(--figma-border)' : 'none' }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{playerName}</div>
                  {isPaid && <div style={{ color: '#64748B', fontSize: 12 }}>{new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} &bull; {p.paymentMode === 'online' ? 'Online' : 'Offline'}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: isPaid ? '#22C55E' : '#EF4444', fontSize: 14, fontWeight: 600 }}>{fmt(p.amount)}</div>
                  {!isPaid && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button type="button" style={{ padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 10, fontWeight: 600 }}>Remind</button>
                      <button type="button" style={{ padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 10, fontWeight: 600 }}>+ Offline</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {payments.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>No payments recorded</div>}
        </div>
        <button type="button" style={{ width: '100%', padding: 12, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={18} /> Add Offline Payment
        </button>
      </div>
    );
  };

  const renderAnnouncements = () => (
    <div>
      <div className="figma-card" style={{ padding: 14, marginBottom: 16 }}>
        <textarea
          placeholder="Write an announcement..."
          value={announcementText}
          onChange={e => setAnnouncementText(e.target.value)}
          rows={3}
          style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', fontSize: 14, outline: 'none', resize: 'none' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="figma-btn-primary" style={{ fontSize: 13, height: 32, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 4 }} disabled={!announcementText.trim() || saving} onClick={handlePostAnnouncement}>
            <Send size={14} /> {saving ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {announcements.map(a => (
          <div key={a._id} className="figma-card" style={{ padding: 14 }}>
            <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.5, marginBottom: 6 }}>{a.message}</div>
            <div style={{ color: '#64748B', fontSize: 12 }}>{new Date(a.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</div>
          </div>
        ))}
        {announcements.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>No announcements yet</div>}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Players': return renderPlayers();
      case 'Sessions': return renderSessions();
      case 'Attendance': return renderAttendance();
      case 'Payments': return renderPayments();
      case 'Announcements': return renderAnnouncements();
      default: return renderPlayers();
    }
  };

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Batch Detail</span>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 28 }}>{sportIcons[b.sport] || '🏅'}</span>
          <div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{b.name}</div>
            <div style={{ color: '#94A3B8', fontSize: 13 }}>{b.venue?.name || b.location?.address || ''}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: activeTab === tab ? '#8B5CF6' : 'var(--figma-card)',
              color: '#fff', fontSize: 13, fontWeight: 600,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {renderTabContent()}
    </div>
  );
}
