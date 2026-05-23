import React, { useState } from 'react';
import { IndianRupee, TrendingUp, TrendingDown, BarChart3, FileText } from 'lucide-react';

const REVENUE_DATA = {
  daily: [
    { label: 'Mon', amount: 8500 },
    { label: 'Tue', amount: 12000 },
    { label: 'Wed', amount: 9500 },
    { label: 'Thu', amount: 15000 },
    { label: 'Fri', amount: 18000 },
    { label: 'Sat', amount: 22000 },
    { label: 'Sun', amount: 20000 },
  ],
  summary: { total: 120000, commission: 12000, net: 108000, bookings: 68, growth: 12 },
};

const RECENT_TRANSACTIONS = [
  { id: 1, player: 'Arjun Patel', facility: 'Football Turf', amount: 1500, date: 'Mar 11', type: 'Online' },
  { id: 2, player: 'Sneha Gupta', facility: 'Badminton Court 1', amount: 800, date: 'Mar 11', type: 'Online' },
  { id: 3, player: 'Vikram Singh', facility: 'Cricket Nets', amount: 600, date: 'Mar 10', type: 'Walk-in' },
  { id: 4, player: 'Priya Verma', facility: 'Football Turf', amount: 2000, date: 'Mar 10', type: 'Online' },
  { id: 5, player: 'Rahul Desai', facility: 'Tennis Court', amount: 1200, date: 'Mar 9', type: 'Online' },
];

export function VenuePaymentsTab() {
  const [period, setPeriod] = useState('week');
  const maxAmount = Math.max(...REVENUE_DATA.daily.map((d) => d.amount));
  const fmt = (n) => '₹' + n.toLocaleString('en-IN');

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Payments</h1>
          <p className="figma-body">Revenue & analytics</p>
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontSize: 12, fontWeight: 600 }}>
          Venue Mode
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1.5rem' }}>
        <div style={{ background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)', padding: 16, borderRadius: 16 }}>
          <IndianRupee size={20} color="#fff" style={{ marginBottom: 6 }} />
          <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{fmt(REVENUE_DATA.summary.total)}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>Total Revenue</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
            <TrendingUp size={14} color="#fff" />
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>+{REVENUE_DATA.summary.growth}%</span>
          </div>
        </div>
        <div className="figma-card" style={{ padding: 16 }}>
          <TrendingDown size={20} color="#EF4444" style={{ marginBottom: 6 }} />
          <div style={{ color: '#EF4444', fontSize: 24, fontWeight: 700 }}>{fmt(REVENUE_DATA.summary.commission)}</div>
          <div style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>Commission (10%)</div>
          <div style={{ color: '#22C55E', fontSize: 14, fontWeight: 700, marginTop: 6 }}>Net: {fmt(REVENUE_DATA.summary.net)}</div>
        </div>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart3 size={18} color="#3B82F6" /> Daily Revenue
          </h3>
          <div style={{ display: 'flex', gap: 4 }}>
            {['week', 'month'].map((p) => (
              <button key={p} type="button" onClick={() => setPeriod(p)} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: period === p ? '#22C55E' : 'transparent', color: '#fff', fontSize: 12, fontWeight: 500 }}>
                {p === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
          {REVENUE_DATA.daily.map((d) => {
            const h = maxAmount > 0 ? (d.amount / maxAmount) * 100 : 0;
            return (
              <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#94A3B8', fontSize: 10 }}>{fmt(d.amount / 1000)}K</span>
                <div style={{ width: '100%', height: `${h}%`, minHeight: 4, background: 'linear-gradient(180deg, #22C55E 0%, #16A34A 100%)', borderRadius: '6px 6px 0 0' }} />
                <span style={{ color: '#64748B', fontSize: 11 }}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ color: '#94A3B8', fontSize: 13 }}>Total Bookings</span>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{REVENUE_DATA.summary.bookings}</span>
        </div>
      </div>

      <div>
        <h2 className="figma-heading2" style={{ marginBottom: 12 }}>Recent Transactions</h2>
        <div className="figma-card" style={{ overflow: 'hidden' }}>
          {RECENT_TRANSACTIONS.map((t, i) => (
            <div key={t.id} style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < RECENT_TRANSACTIONS.length - 1 ? '1px solid var(--figma-border)' : 'none' }}>
              <div>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{t.player}</div>
                <div style={{ color: '#64748B', fontSize: 12 }}>{t.facility} &bull; {t.date}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#22C55E', fontSize: 14, fontWeight: 600 }}>{fmt(t.amount)}</div>
                <span style={{ padding: '2px 6px', borderRadius: 999, fontSize: 10, fontWeight: 500, background: t.type === 'Online' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)', color: t.type === 'Online' ? '#3B82F6' : '#F59E0B' }}>{t.type}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="button" style={{ width: '100%', marginTop: 20, padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'var(--figma-card)', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <FileText size={18} /> Download Report
      </button>
    </div>
  );
}
