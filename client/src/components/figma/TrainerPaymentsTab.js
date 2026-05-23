import React, { useState, useEffect } from 'react';
import { IndianRupee, TrendingUp, AlertCircle, Plus, Bell, RefreshCw } from 'lucide-react';
import trainerApi from '../../services/trainerApi';

const MOCK_SUMMARY = { expected: 96000, collected: 78000, pending: 18000 };
const MOCK_PAYMENTS = [
  { _id: '1', player: { name: 'Arjun Patel' }, batch: { name: 'Morning Cricket' }, amount: 3000, status: 'completed', paymentMode: 'online', createdAt: '2026-03-08' },
  { _id: '2', player: { name: 'Sneha Gupta' }, batch: { name: 'Advanced Badminton' }, amount: 4500, status: 'completed', paymentMode: 'offline', createdAt: '2026-03-07' },
  { _id: '3', player: { name: 'Vikram Singh' }, batch: { name: 'Morning Cricket' }, amount: 3000, status: 'completed', paymentMode: 'online', createdAt: '2026-03-06' },
  { _id: '4', player: { name: 'Priya Verma' }, batch: { name: 'Morning Cricket' }, amount: 3000, status: 'pending', paymentMode: null, createdAt: null },
  { _id: '5', player: { name: 'Rahul Desai' }, batch: { name: 'Advanced Badminton' }, amount: 4500, status: 'pending', paymentMode: null, createdAt: null },
  { _id: '6', player: { name: 'Ananya Roy' }, batch: { name: 'Weekend Football' }, amount: 2500, status: 'pending', paymentMode: null, createdAt: null },
];

export function TrainerPaymentsTab() {
  const [showPaid, setShowPaid] = useState(true);
  const [payments, setPayments] = useState(MOCK_PAYMENTS);
  const [summary, setSummary] = useState(MOCK_SUMMARY);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const batchesRes = await trainerApi.getBatches();
      const payPromises = batchesRes.data.map(b => trainerApi.getPayments(b._id));
      const results = await Promise.all(payPromises);
      const allPayments = results.flatMap((res, i) =>
        res.data.map(p => ({
          ...p,
          batch: { name: batchesRes.data[i].name, _id: batchesRes.data[i]._id }
        }))
      );
      setPayments(allPayments);

      const collected = allPayments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
      const pending = allPayments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
      setSummary({ expected: collected + pending, collected, pending });
    } catch {
      setPayments(MOCK_PAYMENTS);
      setSummary(MOCK_SUMMARY);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, []);

  const fmt = (n) => '₹' + n.toLocaleString('en-IN');

  const paidList = payments.filter(p => p.status === 'completed');
  const pendingList = payments.filter(p => p.status !== 'completed');

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Payments</h1>
          <p className="figma-body">Revenue & collection overview</p>
        </div>
        <button type="button" onClick={fetchPayments} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#94A3B8' }}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
        <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontSize: 12, fontWeight: 600 }}>
          Trainer Mode
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: '2rem' }}>
        <div className="figma-card" style={{ padding: 14, textAlign: 'center' }}>
          <TrendingUp size={18} color="#3B82F6" style={{ marginBottom: 6 }} />
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{fmt(summary.expected)}</div>
          <div style={{ color: '#94A3B8', fontSize: 11 }}>Expected</div>
        </div>
        <div className="figma-card" style={{ padding: 14, textAlign: 'center' }}>
          <IndianRupee size={18} color="#22C55E" style={{ marginBottom: 6 }} />
          <div style={{ color: '#22C55E', fontSize: 18, fontWeight: 700 }}>{fmt(summary.collected)}</div>
          <div style={{ color: '#94A3B8', fontSize: 11 }}>Collected</div>
        </div>
        <div className="figma-card" style={{ padding: 14, textAlign: 'center' }}>
          <AlertCircle size={18} color="#EF4444" style={{ marginBottom: 6 }} />
          <div style={{ color: '#EF4444', fontSize: 18, fontWeight: 700 }}>{fmt(summary.pending)}</div>
          <div style={{ color: '#94A3B8', fontSize: 11 }}>Pending</div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button type="button" onClick={() => setShowPaid(false)} style={{ flex: 1, padding: 10, borderRadius: 12, border: 'none', cursor: 'pointer', background: !showPaid ? '#EF4444' : 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 600 }}>
            Pending ({pendingList.length})
          </button>
          <button type="button" onClick={() => setShowPaid(true)} style={{ flex: 1, padding: 10, borderRadius: 12, border: 'none', cursor: 'pointer', background: showPaid ? '#22C55E' : 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 600 }}>
            Collected ({paidList.length})
          </button>
        </div>

        <div className="figma-card" style={{ overflow: 'hidden' }}>
          {(showPaid ? paidList : pendingList).map((p, i, arr) => {
            const playerName = p.player?.name || p.payer?.name || 'Unknown';
            const initials = playerName.split(' ').map(n => n[0]).join('');
            const isPaid = p.status === 'completed';
            const typeLabel = p.paymentMode === 'online' ? 'Online' : p.paymentMode === 'offline' ? 'Offline' : '';
            return (
              <div key={p._id} style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < arr.length - 1 ? '1px solid var(--figma-border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', fontSize: 14, fontWeight: 600 }}>
                    {initials}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{playerName}</div>
                    <div style={{ color: '#64748B', fontSize: 12 }}>{p.batch?.name || ''}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: isPaid ? '#22C55E' : '#fff', fontSize: 14, fontWeight: 600 }}>{fmt(p.amount)}</div>
                  {isPaid && typeLabel ? (
                    <span style={{ padding: '2px 6px', borderRadius: 999, fontSize: 10, fontWeight: 500, background: typeLabel === 'Online' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)', color: typeLabel === 'Online' ? '#3B82F6' : '#F59E0B' }}>{typeLabel}</span>
                  ) : !isPaid ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button type="button" style={{ padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 10, fontWeight: 600 }}>
                        <Bell size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />Remind
                      </button>
                      <button type="button" style={{ padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 10, fontWeight: 600 }}>
                        <Plus size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />Offline
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {(showPaid ? paidList : pendingList).length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>No payments in this category.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={18} /> Add Offline Payment
        </button>
        <button type="button" style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Bell size={18} /> Send Reminders
        </button>
      </div>
    </div>
  );
}
