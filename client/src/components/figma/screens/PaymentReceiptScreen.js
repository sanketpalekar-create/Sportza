import React from 'react';
import { ChevronLeft, Download, Share2, CheckCircle, XCircle, RotateCcw, Calendar, MapPin, Clock, CreditCard } from 'lucide-react';

export function PaymentReceiptScreen({ payment, onBack }) {
  const p = payment || {
    id: 'PAY-001',
    bookingId: 'BK-101',
    date: 'Feb 20, 2026',
    venue: 'Elite Sports Arena',
    description: 'Badminton · Court 2 · 1 hr',
    amount: 944,
    status: 'paid',
    method: 'UPI',
  };

  const subtotal = Math.round(p.amount / 1.18);
  const gst = p.amount - subtotal;
  const isPaid = p.status === 'paid';
  const isRefunded = p.status === 'refunded';

  const StatusIcon = isPaid ? CheckCircle : isRefunded ? RotateCcw : XCircle;
  const statusColor = isPaid ? '#22C55E' : isRefunded ? '#F59E0B' : '#EF4444';
  const statusLabel = isPaid ? 'Payment Successful' : isRefunded ? 'Refunded' : 'Payment Failed';

  const parts = (p.description || '').split('·').map(s => s.trim());
  const sportName = parts[0] || 'Sport';
  const facilityName = parts[1] || 'Facility';
  const duration = parts[2] || '1 hr';

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Payment Receipt</span>
      </div>

      <div style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)', border: '1px solid var(--figma-border)', borderRadius: 24, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ textAlign: 'center', padding: '28px 20px 20px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: `${statusColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <StatusIcon size={28} color={statusColor} />
          </div>
          <div style={{ color: statusColor, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{statusLabel}</div>
          <div style={{ color: '#fff', fontSize: 36, fontWeight: 800, marginBottom: 4 }}>
            {isRefunded ? (
              <>
                <span style={{ textDecoration: 'line-through', color: '#64748B', fontSize: 22, marginRight: 8 }}>₹{p.amount.toLocaleString('en-IN')}</span>
                <span style={{ color: '#F59E0B' }}>Refunded</span>
              </>
            ) : (
              `₹${p.amount.toLocaleString('en-IN')}`
            )}
          </div>
          <div style={{ color: '#64748B', fontSize: 13 }}>{p.date}</div>
        </div>

        <div style={{ padding: '0 20px' }}>
          <div style={{ height: 1, background: 'var(--figma-border)', position: 'relative' }}>
            <div style={{ position: 'absolute', left: -12, top: -10, width: 20, height: 20, borderRadius: '50%', background: 'var(--figma-bg)' }} />
            <div style={{ position: 'absolute', right: -12, top: -10, width: 20, height: 20, borderRadius: '50%', background: 'var(--figma-bg)' }} />
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Booking Details</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <MapPin size={15} color="#3B82F6" />
              <div>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{p.venue}</div>
                <div style={{ color: '#94A3B8', fontSize: 12 }}>{sportName} · {facilityName}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 13 }}>
                <Calendar size={14} color="#64748B" /> {p.date}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 13 }}>
                <Clock size={14} color="#64748B" /> {duration}
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--figma-border)', marginBottom: 16 }} />

          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Payment Breakdown</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#94A3B8', fontSize: 14 }}>Subtotal</span>
              <span style={{ color: '#fff', fontSize: 14 }}>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#94A3B8', fontSize: 14 }}>GST (18%)</span>
              <span style={{ color: '#fff', fontSize: 14 }}>₹{gst.toLocaleString('en-IN')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#94A3B8', fontSize: 14 }}>Convenience Fee</span>
              <span style={{ color: '#22C55E', fontSize: 14 }}>FREE</span>
            </div>
            <div style={{ height: 1, background: 'var(--figma-border)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Total</span>
              <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>₹{p.amount.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--figma-border)', marginBottom: 16 }} />

          <div>
            <div style={{ color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Transaction Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ color: '#64748B', fontSize: 12 }}>Transaction ID</div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{p.id}</div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: 12 }}>Booking ID</div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{p.bookingId}</div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: 12 }}>Payment Method</div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CreditCard size={13} /> {p.method}
                </div>
              </div>
              <div>
                <div style={{ color: '#64748B', fontSize: 12 }}>Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
                  <span style={{ color: statusColor, fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{p.status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: `Sportza Receipt ${p.id}`, text: `Payment of ₹${p.amount} at ${p.venue} on ${p.date}` }).catch(() => {});
            }
          }}
          style={{
            flex: 1, padding: 14, borderRadius: 14,
            border: '1px solid var(--figma-border)', cursor: 'pointer',
            background: 'transparent', color: '#fff', fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Share2 size={16} /> Share
        </button>
        <button
          type="button"
          onClick={() => {
            window.print();
          }}
          style={{
            flex: 1, padding: 14, borderRadius: 14,
            border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            color: '#fff', fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Download size={16} /> Download
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 28, height: 28, objectFit: 'contain', objectPosition: '51% 52%', opacity: 0.5, marginBottom: 4 }} />
        <div style={{ color: '#475569', fontSize: 11 }}>Sportza &bull; Powered by your game</div>
      </div>
    </div>
  );
}
