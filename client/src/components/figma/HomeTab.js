import React from 'react';
import { MapPin, Clock, Users, Star, ArrowRight, Zap, TrendingUp, Trophy, Dumbbell, Activity } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

export function HomeTab({ onSelectVenue, onViewVenueList, onViewMatchList, onViewTrainerList, onCreateTournament, onInstantBook, onViewBatch, onViewScoring }) {
  const featuredVenues = [
    {
      id: 1,
      name: 'Elite Sports Arena',
      location: 'Koregaon Park',
      image: 'https://images.unsplash.com/photo-1624024834874-2a1611305604?w=400&q=80',
      sport: 'Badminton',
      rating: 4.8,
      price: '₹800',
      pricePerHour: 800,
      available: '2 slots',
    },
    {
      id: 2,
      name: 'Phoenix Tennis Club',
      location: 'Baner',
      image: 'https://images.unsplash.com/photo-1766675122854-28fc70f50132?w=400&q=80',
      sport: 'Tennis',
      rating: 4.9,
      price: '₹1200',
      pricePerHour: 1200,
      available: '5 slots',
    },
    {
      id: 3,
      name: 'Champions Football Arena',
      location: 'Hinjewadi',
      image: 'https://images.unsplash.com/photo-1603508434829-7c4282d74483?w=400&q=80',
      sport: 'Football',
      rating: 4.6,
      price: '₹1500',
      pricePerHour: 1500,
      available: '3 slots',
    },
  ];

  const quickActions = [
    { id: 1, label: 'Instant Book', icon: Zap, color: '#3B82F6', onClick: onInstantBook },
    { id: 2, label: 'Score a Match', icon: Activity, color: '#EF4444', onClick: onViewScoring },
    { id: 3, label: 'Live score', icon: Trophy, color: '#22C55E', onClick: onViewMatchList },
    { id: 4, label: 'Create Tournament', icon: Trophy, color: '#F59E0B', onClick: onCreateTournament },
  ];

  const recommendedTrainings = [
    { id: 1, name: 'Morning Cricket Coaching', sport: 'Cricket', coach: 'Rahul Sharma', venue: 'Champions Arena', level: 'Beginner', schedule: 'Mon, Wed, Fri • 6 AM', players: 12, maxPlayers: 20, price: '₹3,000/mo' },
    { id: 2, name: 'Advanced Badminton', sport: 'Badminton', coach: 'Priya Verma', venue: 'Elite Sports Arena', level: 'Advanced', schedule: 'Tue, Thu • 7 AM', players: 8, maxPlayers: 12, price: '₹4,500/mo' },
    { id: 3, name: 'Football Skills Camp', sport: 'Football', coach: 'Vikram Das', venue: 'Phoenix Football Ground', level: 'Intermediate', schedule: 'Sat, Sun • 5 PM', players: 15, maxPlayers: 24, price: '₹2,500/mo' },
  ];

  const sportIcons = { Cricket: '🏏', Badminton: '🏸', Football: '⚽', Tennis: '🎾', Basketball: '🏀' };
  const levelColor = (l) => l === 'Beginner' ? '#22C55E' : l === 'Intermediate' ? '#3B82F6' : '#F59E0B';

  const upcomingBooking = {
    venue: 'Elite Sports Arena',
    sport: 'Badminton',
    date: 'Today',
    time: '6:00 PM - 7:00 PM',
    court: 'Court 2',
  };

  return (
    <div className="figma-page">
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.png" alt="Sportza" style={{ width: 40, height: 40, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
            <div>
              <h1 className="figma-heading1" style={{ marginBottom: 4 }}>Welcome back</h1>
              <p className="figma-body">Let's book your next game</p>
            </div>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 600 }}>AP</div>
        </div>
      </div>

      <div className="figma-grid3 figma-gap3" style={{ marginBottom: '2rem' }}>
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              className="figma-card figma-flex-col figma-gap3"
              style={{ padding: '1rem', border: 'none', cursor: 'pointer', textAlign: 'center' }}
              onClick={() => action.onClick && action.onClick()}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <Icon size={20} color={action.color} />
              </div>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 400 }}>{action.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div className="figma-flex-between" style={{ marginBottom: 16 }}>
          <h2 className="figma-heading2">Next Game</h2>
          <button className="figma-link">View all <ArrowRight size={16} /></button>
        </div>
        <div style={{ background: '#3B82F6', padding: 16, borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{upcomingBooking.venue}</h3>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 500 }}>{upcomingBooking.sport} • {upcomingBooking.court}</p>
            </div>
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: 999, color: '#fff', fontSize: 12, fontWeight: 500 }}>{upcomingBooking.date}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="#fff" />
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>{upcomingBooking.time}</span>
          </div>
        </div>
      </div>

      {/* Featured venue hero (SportsBookingFullApp style) */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ height: 180, borderRadius: 20, overflow: 'hidden', position: 'relative', cursor: 'pointer' }} className="figma-card" onClick={() => onSelectVenue && onSelectVenue(featuredVenues[0])}>
          <ImageWithFallback src={featuredVenues[0].image} alt={featuredVenues[0].name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.7) 0%,transparent 60%)' }} />
          <div style={{ position: 'absolute', top: 12, left: 12, padding: '4px 12px', borderRadius: 999, background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)' }}>
            <span style={{ fontSize: 10, color: '#fff', fontWeight: 600, letterSpacing: '.5px' }}>⭐ FEATURED</span>
          </div>
          <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
            <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{featuredVenues[0].name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} color="rgba(255,255,255,.7)" /><span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{featuredVenues[0].location}</span></div>
              <span style={{ color: '#22C55E', fontSize: 16, fontWeight: 700 }}>{featuredVenues[0].price}<span style={{ fontSize: 11, fontWeight: 400 }}>/hr</span></span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="figma-flex-between" style={{ marginBottom: 16 }}>
          <h2 className="figma-heading2">Nearby Venues</h2>
          <button type="button" className="figma-link" onClick={() => onViewVenueList && onViewVenueList()}>See all <ArrowRight size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {featuredVenues.map((venue) => (
            <div key={venue.id} className="figma-card" style={{ overflow: 'hidden', minWidth: 200, flexShrink: 0, cursor: 'pointer' }} onClick={() => onSelectVenue && onSelectVenue(venue)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelectVenue && onSelectVenue(venue)}>
              <div style={{ height: 110, position: 'relative' }}>
                <ImageWithFallback src={venue.image} alt={venue.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', top: 12, right: 12, background: '#111827', padding: '4px 12px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={12} color="#F59E0B" fill="#F59E0B" />
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 500 }}>{venue.rating}</span>
                </div>
                <div style={{ position: 'absolute', top: 12, left: 12, padding: '4px 12px', borderRadius: 999, background: 'rgba(59,130,246,0.15)' }}>
                  <span style={{ color: '#3B82F6', fontSize: 12, fontWeight: 500 }}>{venue.sport}</span>
                </div>
              </div>
              <div style={{ padding: 12 }}>
                <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{venue.name}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} color="#64748B" /><span style={{ fontSize: 11, color: '#94A3B8' }}>{venue.location}</span></div>
                  <span style={{ color: '#3B82F6', fontSize: 15, fontWeight: 700 }}>{venue.price}<span style={{ fontSize: 10, color: '#64748B', fontWeight: 400 }}>/hr</span></span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <div className="figma-flex-between" style={{ marginBottom: 16 }}>
          <h2 className="figma-heading2">Improve Your Game</h2>
          <button type="button" className="figma-link" onClick={() => onViewTrainerList && onViewTrainerList()}>See all <ArrowRight size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {recommendedTrainings.map((t) => (
            <div key={t.id} className="figma-card" style={{ minWidth: 260, flexShrink: 0, padding: 16, cursor: 'pointer' }} onClick={() => onViewBatch && onViewBatch(t)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onViewBatch && onViewBatch(t)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 28 }}>{sportIcons[t.sport] || '🏅'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{t.name}</div>
                  <div style={{ color: '#94A3B8', fontSize: 12 }}>Coach {t.coach}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#94A3B8', fontSize: 12 }}>
                <MapPin size={12} /> {t.venue}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 8px', borderRadius: 999, background: `${levelColor(t.level)}15`, color: levelColor(t.level), fontSize: 11, fontWeight: 600 }}>{t.level}</span>
                <span style={{ color: '#64748B', fontSize: 12 }}>{t.schedule}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94A3B8', fontSize: 12 }}>
                  <Users size={14} /> {t.players}/{t.maxPlayers}
                </div>
                <span style={{ color: '#3B82F6', fontSize: 14, fontWeight: 700 }}>{t.price}</span>
              </div>
              <button type="button" className="figma-btn-primary" style={{ width: '100%', marginTop: 12, fontSize: 13 }} onClick={(e) => { e.stopPropagation(); onViewBatch && onViewBatch(t); }}>
                View Batch
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
