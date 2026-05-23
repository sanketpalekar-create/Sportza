import React from 'react';
import { ChevronLeft, MapPin, Star, ChevronRight, Dumbbell, Award, Users, Clock, Calendar } from 'lucide-react';

export function TrainerDetailScreen({ trainer, onBack, onViewReviews, onViewBatch }) {
  const t = trainer || {
    id: '1',
    name: 'Arjun Kumar',
    sports: ['Badminton', 'Tennis'],
    city: 'Pune',
    rating: 4.9,
    reviewCount: 48,
    bio: 'Former state player. 8+ years coaching experience. Focus on technique and match play.',
    batchesCount: 3,
    experience: 8,
  };
  const sportsList = t.sports && t.sports.length ? t.sports : (t.sport ? [t.sport] : []);

  const achievements = [
    { id: 1, label: 'Former District Player', icon: '🏆' },
    { id: 2, label: 'Certified Coach', icon: '📋' },
    { id: 3, label: 'Tournament Winner', icon: '🥇' },
  ];

  const sportsCoached = [
    { sport: 'Cricket', specialties: ['Batting', 'Fielding'] },
    { sport: 'Badminton', specialties: ['Singles', 'Doubles'] },
  ];

  const currentBatches = [
    { id: 1, name: 'Morning Cricket Coaching', venue: 'Champions Arena', schedule: 'Mon, Wed, Fri • 6:00 AM', players: 12, maxPlayers: 20, price: '₹3,000/mo', sport: 'Cricket', level: 'Beginner' },
    { id: 2, name: 'Advanced Badminton', venue: 'Elite Sports Arena', schedule: 'Tue, Thu • 7:00 AM', players: 8, maxPlayers: 12, price: '₹4,500/mo', sport: 'Badminton', level: 'Advanced' },
  ];

  const sportIcons = { Cricket: '🏏', Badminton: '🏸', Football: '⚽', Tennis: '🎾', Basketball: '🏀' };
  const levelColor = (l) => l === 'Beginner' ? '#22C55E' : l === 'Intermediate' ? '#3B82F6' : '#F59E0B';

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Trainer Profile</span>
      </div>

      <div className="figma-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 600, flexShrink: 0 }}>
            {t.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <h1 className="figma-heading1" style={{ marginBottom: 4 }}>{t.name}</h1>
            <div style={{ color: '#94A3B8', fontSize: 14, marginBottom: 6 }}>
              {sportsList[0] || 'Sports'} Coach &bull; {t.experience || 8} Years Experience
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {sportsList.map((s) => (
                <span key={s} style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 13, fontWeight: 500 }}>{s}</span>
              ))}
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 14 }}>
                <MapPin size={14} /> {t.city}
              </span>
            </div>
          </div>
        </div>
        {t.bio && <p style={{ color: '#94A3B8', fontSize: 14, lineHeight: 1.5 }}>{t.bio}</p>}
      </div>

      <div
        className="figma-card"
        style={{ padding: 16, marginBottom: 20, cursor: onViewReviews ? 'pointer' : 'default' }}
        onClick={() => onViewReviews && onViewReviews(t)}
        role={onViewReviews ? 'button' : undefined}
        tabIndex={onViewReviews ? 0 : undefined}
        onKeyDown={(e) => onViewReviews && e.key === 'Enter' && onViewReviews(t)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Star size={20} color="#F59E0B" fill="#F59E0B" />
            <div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{t.rating} &middot; {t.reviewCount ?? 0} reviews</div>
              <div style={{ color: '#94A3B8', fontSize: 13 }}>View reviews</div>
            </div>
          </div>
          {onViewReviews && <ChevronRight size={20} color="#64748B" />}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 className="figma-heading2" style={{ marginBottom: 12 }}>Achievements</h2>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {achievements.map((a) => (
            <div key={a.id} className="figma-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 22 }}>{a.icon}</span>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{a.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h2 className="figma-heading2" style={{ marginBottom: 12 }}>Sports Coached</h2>
        <div className="figma-card" style={{ padding: 16 }}>
          {sportsCoached.map((sc, i) => (
            <div key={sc.sport} style={{ marginBottom: i < sportsCoached.length - 1 ? 16 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{sportIcons[sc.sport] || '🏅'}</span>
                <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{sc.sport}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {sc.specialties.map((sp) => (
                  <span key={sp} style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', fontSize: 12, fontWeight: 500 }}>{sp}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="figma-heading2" style={{ marginBottom: 12 }}>Current Trainings</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {currentBatches.map((batch) => (
            <div key={batch.id} className="figma-card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => onViewBatch && onViewBatch(batch)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onViewBatch && onViewBatch(batch)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{sportIcons[batch.sport] || '🏅'}</span>
                  <div>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{batch.name}</div>
                    <div style={{ color: '#94A3B8', fontSize: 12 }}>{batch.venue}</div>
                  </div>
                </div>
                <span style={{ padding: '3px 8px', borderRadius: 999, background: `${levelColor(batch.level)}15`, color: levelColor(batch.level), fontSize: 11, fontWeight: 600 }}>{batch.level}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {batch.schedule}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 13 }}>
                  <Users size={14} /> {batch.players}/{batch.maxPlayers} joined
                </div>
                <span style={{ color: '#3B82F6', fontSize: 14, fontWeight: 700 }}>{batch.price}</span>
              </div>
              <button type="button" className="figma-btn-primary" style={{ width: '100%', marginTop: 12, fontSize: 13 }} onClick={(e) => { e.stopPropagation(); onViewBatch && onViewBatch(batch); }}>
                View Batch
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
