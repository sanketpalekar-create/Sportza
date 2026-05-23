import React, { useState } from 'react';
import { ChevronLeft, Calendar, CreditCard, FileText } from 'lucide-react';

const MOCK_PAYMENTS = [
  { id: 'PAY-001', bookingId: 'BK-101', date: 'Feb 20, 2026', venue: 'Elite Sports Arena', description: 'Badminton · Court 2 · 1 hr', amount: 944, status: 'paid', method: 'UPI' },
  { id: 'PAY-002', bookingId: 'BK-102', date: 'Feb 18, 2026', venue: 'Champions Football Arena', description: 'Football · Field A · 1 hr', amount: 1770, status: 'paid', method: 'Card' },
  { id: 'PAY-003', bookingId: 'BK-103', date: 'Feb 15, 2026', venue: 'Victory Cricket Ground', description: 'Cricket · Pitch 1 · 2 hrs', amount: 4720, status: 'paid', method: 'UPI' },
  { id: 'PAY-004', bookingId: 'BK-104', date: 'Feb 12, 2026', venue: 'Phoenix Tennis Club', description: 'Tennis · Court 1 · 1.5 hrs', amount: 2124, status: 'refunded', method: 'Card' },
  { id: 'PAY-005', bookingId: 'BK-105', date: 'Feb 10, 2026', venue: 'Elite Sports Arena', description: 'Badminton · Court 1 · 1 hr', amount: 944, status: 'paid', method: 'UPI' },
];

const PERIODS = ['All', 'This month', 'Last 3 months', 'This year'];

export function PaymentHistoryScreen({ onBack, onViewReceipt }) {
  const [period, setPeriod] = useState('All');

  const getStatusStyle = (status) => {
    if (status === 'paid') return { color: '#22C55E', background: 'rgba(34,197,94,0.15)' };
    if (status === 'refunded') return { color: '#F59E0B', background: 'rgba(245,158,11,0.15)' };
    if (status === 'failed') return { color: '#EF4444', background: 'rgba(239,68,68,0.15)' };
    return { color: '#94A3B8', background: 'rgba(148,163,184,0.15)' };
  };

  const totalPaid = MOCK_PAYMENTS.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const countPaid = MOCK_PAYMENTS.filter((p) => p.status === 'paid').length;

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Payment History</span>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={22} color="#22C55E" />
          </div>
          <div>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 2 }}>Total paid</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>₹{totalPaid.toLocaleString('en-IN')}</div>
            <div style={{ color: '#94A3B8', fontSize: 12 }}>{countPaid} transaction{countPaid !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: period === p ? 'var(--figma-primary)' : 'var(--figma-card)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 12 }}>Recent payments</div>

      <div className="figma-space-y-4">
        {MOCK_PAYMENTS.map((payment) => (
          <div key={payment.id} className="figma-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{payment.venue}</div>
                <div style={{ color: '#94A3B8', fontSize: 13 }}>{payment.description}</div>
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500, ...getStatusStyle(payment.status) }}>{payment.status}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>
              <Calendar size={14} /> {payment.date}
              <span style={{ marginLeft: 8 }}>·</span>
              <span>{payment.method}</span>
              <span>·</span>
              <span>{payment.id}</span>
            </div>
            <div className="figma-divider" style={{ paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {payment.status === 'refunded' && <div style={{ color: '#94A3B8', fontSize: 12, textDecoration: 'line-through' }}>₹{payment.amount.toLocaleString('en-IN')}</div>}
                <div style={{ color: payment.status === 'refunded' ? '#F59E0B' : '#fff', fontSize: 18, fontWeight: 700 }}>
                  {payment.status === 'refunded' ? 'Refunded' : `₹${payment.amount.toLocaleString('en-IN')}`}
                </div>
              </div>
              <button
                type="button"
                className="figma-btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => onViewReceipt && onViewReceipt(payment)}
              >
                <FileText size={16} /> Receipt
              </button>
            </div>
          </div>
        ))}
      </div>

      {MOCK_PAYMENTS.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8', fontSize: 14 }}>No payments in this period.</div>
      )}
    </div>
  );
}
