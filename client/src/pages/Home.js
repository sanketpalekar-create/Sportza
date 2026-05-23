import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SportsBookingBlock from '../components/SportsBookingBlock';
import './Home.css';

const Home = () => {
  const { user } = useAuth();

  return (
    <div className="home">
      <div className="hero">
        <p style={{ marginBottom: 8 }}>
          <a href="/app" style={{ color: '#3B82F6', fontSize: 14 }}>Try mobile-style UI (Figma design) →</a>
        </p>
        <img src="/logo.png" alt="Sportza" className="hero-logo" />
        <h1>Welcome to Sportza</h1>
        <p>Book venues, train, and track your game. Pune's platform for sports.</p>
        {!user && (
          <div className="hero-buttons">
            <Link to="/register" className="btn btn-primary">Get Started</Link>
            <Link to="/venues" className="btn btn-secondary">Browse Venues</Link>
          </div>
        )}
        {user && (
          <div className="hero-buttons">
            <Link to="/venues" className="btn btn-primary">Book a Venue</Link>
            <Link to="/matches" className="btn btn-secondary">View Matches</Link>
          </div>
        )}
      </div>

      <SportsBookingBlock
        title="Sports Booking"
        subtitle="Book courts, turfs, and facilities. Find venues by sport and location."
        primaryLabel={user ? 'Book a Venue' : 'Find Venues'}
        primaryTo="/venues"
        secondaryLabel={user ? 'My Bookings' : null}
        secondaryTo={user ? '/bookings' : null}
      />

      <div className="features">
        <div className="feature-card">
          <div className="feature-icon">🏟️</div>
          <h3>Venue Booking</h3>
          <p>Browse and book venues for cricket, football, basketball, and more</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3>Player Stats</h3>
          <p>Track your performance across all matches and sports automatically</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⚽</div>
          <h3>Match Management</h3>
          <p>Create matches, track scores, and manage teams seamlessly</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">💳</div>
          <h3>Secure Payments</h3>
          <p>Safe and secure payment processing for all your bookings</p>
        </div>
      </div>

      <div className="sports-section">
        <h2>Supported Sports</h2>
        <div className="sports-grid">
          {['Cricket', 'Football', 'Basketball', 'Tennis', 'Badminton', 'Volleyball'].map(sport => (
            <div key={sport} className="sport-card">
              {sport === 'Cricket' && '🏏'}
              {sport === 'Football' && '⚽'}
              {sport === 'Basketball' && '🏀'}
              {sport === 'Tennis' && '🎾'}
              {sport === 'Badminton' && '🏸'}
              {sport === 'Volleyball' && '🏐'}
              <span>{sport}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
