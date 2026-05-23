import React from 'react';
import { Home, Calendar, Activity, BarChart3, User, LayoutDashboard, Layers, CreditCard, Building2 } from 'lucide-react';

const PLAYER_TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'score-match', label: 'Score Match', icon: Activity },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: User },
];

const TRAINER_TABS = [
  { id: 'trainer-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'trainer-batches', label: 'Batches', icon: Layers },
  { id: 'trainer-sessions', label: 'Sessions', icon: Calendar },
  { id: 'trainer-payments', label: 'Payments', icon: CreditCard },
  { id: 'profile', label: 'Profile', icon: User },
];

const VENUE_TABS = [
  { id: 'venue-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'venue-bookings', label: 'Bookings', icon: Calendar },
  { id: 'venue-facilities', label: 'Facilities', icon: Building2 },
  { id: 'venue-payments', label: 'Payments', icon: CreditCard },
  { id: 'profile', label: 'Profile', icon: User },
];

export function getTabsForMode(mode) {
  if (mode === 'trainer') return TRAINER_TABS;
  if (mode === 'venue_owner') return VENUE_TABS;
  return PLAYER_TABS;
}

export function getDefaultTab(mode) {
  return getTabsForMode(mode)[0].id;
}

export function BottomNav({ activeTab, setActiveTab, currentMode }) {
  const tabs = getTabsForMode(currentMode);

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 72, background: 'var(--figma-nav)', zIndex: 50 }}>
      <div style={{ maxWidth: '28rem', margin: '0 auto', height: '100%', padding: '0 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const color = isActive ? '#3B82F6' : '#64748B';
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '8px 12px',
                  minWidth: 60,
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #3B82F6' : '2px solid transparent',
                  cursor: 'pointer',
                  color,
                }}
              >
                <Icon size={24} />
                <span style={{ fontSize: 12, fontWeight: 500 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
