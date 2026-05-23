import React, { useEffect, useState } from 'react';
import { ChevronLeft, Smartphone, CreditCard, Building2 } from 'lucide-react';
import { useNav } from '../../../context/NavContext';

const PAYMENT_METHODS = [
  { id: 'upi', label: 'UPI', sublabel: 'GPay, PhonePe, Paytm & more', icon: Smartphone },
  { id: 'card', label: 'Card', sublabel: 'Credit / Debit', icon: CreditCard },
  { id: 'netbanking', label: 'Net Banking', sublabel: 'All banks', icon: Building2 },
];

export function PaymentScreen({ total, onBack, onPaySuccess }) {
  const { setHideBottomNav } = useNav();
  const [method, setMethod] = useState('upi');

  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  return (
    <div className="figma-page" style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}><ChevronLeft size={24} /></button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Pay</span>
      </div>

      <div className="figma-card" style={{ padding: 24, marginBottom: 24, textAlign: 'center' }}>
        <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>Amount to pay</div>
        <div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>₹{total || 0}</div>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 24 }}>
        <div className="figma-body" style={{ marginBottom: 12 }}>Payment method</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  borderRadius: 12,
                  border: active ? '2px solid var(--figma-primary)' : '1px solid var(--figma-border)',
                  background: active ? 'rgba(59,130,246,0.1)' : 'var(--figma-bg)',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: active ? 'var(--figma-primary)' : 'var(--figma-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} color={active ? '#fff' : '#94A3B8'} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{m.label}</div>
                  <div style={{ color: '#94A3B8', fontSize: 12 }}>{m.sublabel}</div>
                </div>
              </button>
            );
          })}
        </div>
        <p style={{ color: '#64748B', fontSize: 12, marginTop: 12, marginBottom: 0 }}>Powered by Razorpay · UPI, cards & net banking supported</p>
      </div>

      <div style={{ position: 'sticky', bottom: 0 }}>
        <button
          className="figma-btn-primary"
          style={{ width: '100%' }}
          onClick={() => onPaySuccess && onPaySuccess({ method })}
        >
          {method === 'upi' ? 'Pay with UPI' : method === 'card' ? 'Pay with Card' : 'Pay with Net Banking'}
        </button>
      </div>
    </div>
  );
}
