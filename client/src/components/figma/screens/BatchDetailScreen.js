import React, { useState } from 'react';
import { ChevronLeft, MapPin, Users, Calendar, Clock, Target, IndianRupee, CheckCircle, X, AlertCircle } from 'lucide-react';

export function BatchDetailScreen({ batch, onBack, onJoinBatch }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  const b = batch || {
    id: 1,
    name: 'Morning Cricket Coaching',
    sport: 'Cricket',
    coach: 'Rahul Sharma',
    venue: 'Champions Arena',
    level: 'Beginner',
    schedule: 'Mon, Wed, Fri',
    startTime: '6:00 AM',
    endTime: '7:30 AM',
    players: 12,
    maxPlayers: 20,
    price: '₹3,000/mo',
  };

  const sportIcons = { Cricket: '🏏', Badminton: '🏸', Football: '⚽', Tennis: '🎾', Basketball: '🏀', 'Table Tennis': '🏓', Volleyball: '🏐' };
  const levelColor = b.level === 'Beginner' ? '#22C55E' : b.level === 'Intermediate' ? '#3B82F6' : '#F59E0B';
  const isFull = b.players >= b.maxPlayers;

  const trainingFocus = [
    'Batting technique & stance correction',
    'Footwork drills & agility',
    'Match simulations & game sense',
    'Fitness & conditioning',
  ];

  const handleJoin = () => {
    setJoining(true);
    setTimeout(() => {
      setJoining(false);
      setJoined(true);
      setShowConfirm(false);
    }, 1500);
  };

  if (joined) {
    return (
      <div className="figma-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <CheckCircle size={42} color="#22C55E" />
        </div>
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>You're In!</h1>
        <p style={{ color: '#94A3B8', fontSize: 15, marginBottom: 8, maxWidth: 280 }}>
          You've successfully joined <span style={{ color: '#fff', fontWeight: 600 }}>{b.name}</span>
        </p>
        <p style={{ color: '#64748B', fontSize: 13, marginBottom: 32, maxWidth: 280 }}>
          Coach {b.coach} will be notified. Your first session starts as per the batch schedule.
        </p>

        <div className="figma-card" style={{ padding: 16, width: '100%', maxWidth: 340, marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 12 }}>Batch Summary</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Sport</span>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{sportIcons[b.sport] || '🏅'} {b.sport}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Schedule</span>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{b.schedule}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Time</span>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{b.startTime} - {b.endTime}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Monthly Fee</span>
            <span style={{ color: '#22C55E', fontSize: 13, fontWeight: 600 }}>{b.price}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 340 }}>
          <button
            type="button"
            onClick={() => { if (onJoinBatch) onJoinBatch(b); else onBack(); }}
            style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', color: '#fff', fontSize: 15, fontWeight: 600 }}
          >
            View My Batches
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{ flex: 1, padding: 14, borderRadius: 14, border: '1px solid var(--figma-border)', cursor: 'pointer', background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 600 }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="figma-page" style={{ paddingBottom: '6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Batch Details</span>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 36 }}>{sportIcons[b.sport] || '🏅'}</span>
          <div style={{ flex: 1 }}>
            <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 4 }}>{b.name}</h1>
            <div style={{ color: '#94A3B8', fontSize: 14 }}>Coach {b.coach}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 13 }}>
          <MapPin size={14} /> {b.venue}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="figma-card" style={{ padding: 16, textAlign: 'center' }}>
          <Target size={20} color={levelColor} style={{ marginBottom: 8 }} />
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Skill Level</div>
          <span style={{ padding: '3px 10px', borderRadius: 999, background: `${levelColor}15`, color: levelColor, fontSize: 12, fontWeight: 600 }}>{b.level}</span>
        </div>
        <div className="figma-card" style={{ padding: 16, textAlign: 'center' }}>
          <Users size={20} color={isFull ? '#EF4444' : '#3B82F6'} style={{ marginBottom: 8 }} />
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Batch Size</div>
          <div style={{ color: isFull ? '#EF4444' : '#94A3B8', fontSize: 13 }}>
            {b.players}/{b.maxPlayers} joined {isFull && '(Full)'}
          </div>
        </div>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} color="#3B82F6" /> Schedule
        </h3>
        <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>
          <span style={{ color: '#fff', fontWeight: 500 }}>{b.schedule}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14 }}>
          <Clock size={14} /> {b.startTime || '6:00 AM'} - {b.endTime || '7:30 AM'}
        </div>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Training Focus</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {trainingFocus.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94A3B8', fontSize: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3B82F6', flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 24 }}>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <IndianRupee size={18} color="#22C55E" /> Pricing
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94A3B8', fontSize: 14 }}>Monthly fee</span>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{b.price}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={isFull}
        style={{
          width: '100%', padding: 16, borderRadius: 16, border: 'none',
          cursor: isFull ? 'not-allowed' : 'pointer',
          background: isFull ? '#334155' : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
          color: isFull ? '#94A3B8' : '#fff', fontSize: 16, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {isFull ? 'Batch Full' : 'Join Batch'}
      </button>

      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 430, background: '#1E293B', borderRadius: '24px 24px 0 0', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Confirm Joining</h2>
              <button type="button" onClick={() => setShowConfirm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                <X size={22} />
              </button>
            </div>

            <div className="figma-card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>{sportIcons[b.sport] || '🏅'}</span>
                <div>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{b.name}</div>
                  <div style={{ color: '#94A3B8', fontSize: 13 }}>Coach {b.coach}</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--figma-border)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#94A3B8', fontSize: 13 }}>Schedule</span>
                  <span style={{ color: '#fff', fontSize: 13 }}>{b.schedule}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#94A3B8', fontSize: 13 }}>Time</span>
                  <span style={{ color: '#fff', fontSize: 13 }}>{b.startTime} - {b.endTime}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94A3B8', fontSize: 13 }}>Monthly Fee</span>
                  <span style={{ color: '#22C55E', fontSize: 15, fontWeight: 700 }}>{b.price}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(59,130,246,0.08)', marginBottom: 20 }}>
              <AlertCircle size={16} color="#3B82F6" style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ color: '#94A3B8', fontSize: 12, lineHeight: 1.5 }}>
                By joining, you agree to the batch schedule and fee. The coach will confirm your enrollment. Payment will be collected for the first month.
              </span>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: '1px solid var(--figma-border)', cursor: 'pointer', background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining}
                style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', color: '#fff', fontSize: 15, fontWeight: 700, opacity: joining ? 0.7 : 1 }}
              >
                {joining ? 'Joining...' : 'Confirm & Join'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
