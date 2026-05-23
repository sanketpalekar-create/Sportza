import React, { useState } from 'react';
import { User, MapPin, Phone, Mail, Bell, CreditCard, HelpCircle, LogOut, ChevronRight, Settings, Shield, Trophy, RefreshCw, X, Dumbbell, Building2 } from 'lucide-react';

const MODE_OPTIONS = [
  { id: 'player', label: 'Player', description: 'Book venues, join open play, find trainers', icon: User, color: '#3B82F6' },
  { id: 'trainer', label: 'Trainer', description: 'Manage batches, track attendance & payments', icon: Dumbbell, color: '#8B5CF6' },
  { id: 'venue_owner', label: 'Venue Owner', description: 'Manage facilities, bookings & revenue', icon: Building2, color: '#22C55E' },
];

const MODE_LABELS = { player: 'Player Mode', trainer: 'Trainer Mode', venue_owner: 'Venue Mode' };

function RoleSwitchModal({ currentMode, onSwitch, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: '28rem', background: '#1E293B', borderRadius: '24px 24px 0 0', padding: '24px 16px 32px', zIndex: 201 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Switch Role</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
            <X size={24} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MODE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = currentMode === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => { onSwitch(opt.id); onClose(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16, padding: 16,
                  background: isActive ? `${opt.color}15` : 'var(--figma-card)',
                  border: isActive ? `2px solid ${opt.color}` : '2px solid transparent',
                  borderRadius: 16, cursor: 'pointer', width: '100%', textAlign: 'left',
                }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${opt.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={24} color={opt.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{opt.label}</div>
                  <div style={{ color: '#94A3B8', fontSize: 13 }}>{opt.description}</div>
                </div>
                {isActive && (
                  <div style={{ padding: '4px 10px', borderRadius: 999, background: `${opt.color}20`, color: opt.color, fontSize: 12, fontWeight: 600 }}>Active</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ProfileTab({ onCreateTournament, onViewTournaments, currentMode, onSwitchRole }) {
  const [showRoleModal, setShowRoleModal] = useState(false);
  const user = { name: 'Arjun Patel', email: 'arjun.patel@example.com', phone: '+91 98765 43210', location: 'Pune, Maharashtra', memberSince: 'Jan 2025', tier: 'Premium' };
  const stats = [
    { label: 'Games', value: '42' },
    { label: 'Win Rate', value: '68%' },
    { label: 'Hours', value: '87h' },
  ];

  const myBatches = [
    { id: 1, name: 'Morning Cricket Coaching', coach: 'Rahul Sharma', sport: 'Cricket', schedule: 'Mon, Wed, Fri • 6:00 AM', venue: 'Champions Arena' },
    { id: 2, name: 'Advanced Badminton', coach: 'Priya Verma', sport: 'Badminton', schedule: 'Tue, Thu • 7:00 AM', venue: 'Elite Sports Arena' },
  ];

  const menuItems = [
    { section: 'Account', items: [
      { id: 1, label: 'Edit Profile', icon: User },
      { id: 2, label: 'Payment Methods', icon: CreditCard },
      { id: 3, label: 'Notifications', icon: Bell },
    ]},
    ...(currentMode === 'player' ? [{ section: 'Training', items: [
      { id: 'my-batches-section', label: 'My Batches', icon: Dumbbell, badge: myBatches.length },
    ]}] : []),
    { section: 'Organize', items: [
      { id: 'view-tournaments', label: 'My Tournaments', icon: Trophy, onClick: onViewTournaments },
      { id: 'create-tournament', label: 'Create Tournament', icon: Trophy, onClick: onCreateTournament },
    ]},
    { section: 'Role', items: [
      { id: 'switch-role', label: 'Switch Role', icon: RefreshCw, subtitle: MODE_LABELS[currentMode] || 'Player Mode', onClick: () => setShowRoleModal(true) },
    ]},
    { section: 'Preferences', items: [
      { id: 4, label: 'Settings', icon: Settings },
      { id: 5, label: 'Privacy & Security', icon: Shield },
    ]},
    { section: 'Support', items: [
      { id: 6, label: 'Help Center', icon: HelpCircle },
      { id: 7, label: 'Log Out', icon: LogOut, danger: true },
    ]},
  ];

  const initials = user.name.split(' ').map((n) => n[0]).join('');

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Profile</h1>
          <p className="figma-body">Manage your account</p>
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 12, fontWeight: 600 }}>
          {MODE_LABELS[currentMode] || 'Player Mode'}
        </div>
      </div>

      <div className="figma-card" style={{ padding: 24, marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <h2 className="figma-heading2" style={{ margin: 0 }}>{user.name}</h2>
              <span className="figma-badge figma-badge-primary">{user.tier}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 14, fontWeight: 500 }}><Mail size={14} /> {user.email}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 14, fontWeight: 500 }}><Phone size={14} /> {user.phone}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8', fontSize: 14, fontWeight: 500 }}><MapPin size={14} /> {user.location}</div>
            </div>
          </div>
        </div>
        <div className="figma-divider" style={{ paddingTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, textAlign: 'center' }}>
          {stats.map((s) => (
            <div key={s.label}>
              <div style={{ color: '#fff', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{s.value}</div>
              <div style={{ color: '#94A3B8', fontSize: 12 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {currentMode === 'player' && myBatches.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#94A3B8', fontSize: 14, fontWeight: 500, marginBottom: 12, paddingLeft: 8 }}>My Batches</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {myBatches.map((batch) => (
              <div key={batch.id} className="figma-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{batch.name}</div>
                    <div style={{ color: '#94A3B8', fontSize: 13 }}>Coach: {batch.coach}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 12, fontWeight: 500 }}>{batch.sport}</span>
                </div>
                <div style={{ color: '#64748B', fontSize: 13 }}>{batch.schedule} &bull; {batch.venue}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="figma-space-y-4" style={{ gap: '2rem' }}>
        {menuItems.map((section) => (
          <div key={section.section}>
            <h3 style={{ color: '#94A3B8', fontSize: 14, fontWeight: 500, marginBottom: 12, paddingLeft: 8 }}>{section.section}</h3>
            <div className="figma-card" style={{ overflow: 'hidden' }}>
              {section.items.map((item, index) => {
                const Icon = item.icon;
                const isLast = index === section.items.length - 1;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick || undefined}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 16,
                      background: 'none',
                      border: 'none',
                      borderBottom: isLast ? 'none' : '1px solid var(--figma-border)',
                      cursor: 'pointer',
                      color: item.danger ? '#EF4444' : '#fff',
                      fontSize: 16,
                      fontWeight: 500,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: item.danger ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={20} color={item.danger ? '#EF4444' : '#3B82F6'} />
                      </div>
                      <div>
                        <span>{item.label}</span>
                        {item.subtitle && <div style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{item.subtitle}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.badge != null && (
                        <span style={{ minWidth: 22, height: 22, borderRadius: 999, background: '#3B82F6', color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{item.badge}</span>
                      )}
                      <ChevronRight size={20} color={item.danger ? '#EF4444' : '#94A3B8'} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#64748B', fontSize: 14, fontWeight: 500 }}>Member since {user.memberSince}</p>
        <p style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>Version 2.0.0</p>
      </div>

      {showRoleModal && (
        <RoleSwitchModal
          currentMode={currentMode}
          onSwitch={onSwitchRole}
          onClose={() => setShowRoleModal(false)}
        />
      )}
    </div>
  );
}
