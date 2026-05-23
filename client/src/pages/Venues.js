import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Venues.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Venues = () => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sport: '', city: 'Pune', search: '' });

  useEffect(() => {
    fetchVenues();
  }, [filters]);

  const fetchVenues = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.sport) params.append('sport', filters.sport);
      if (filters.city) params.append('city', filters.city);
      if (filters.search) params.append('search', filters.search);

      const response = await axios.get(`${API_URL}/venues?${params}`);
      setVenues(response.data);
    } catch (error) {
      console.error('Error fetching venues:', error);
    } finally {
      setLoading(false);
    }
  };

  const sports = ['cricket', 'football', 'basketball', 'tennis', 'badminton', 'volleyball'];

  // Get list of sports and min price for a venue (sports array + sportRates or legacy pricePerHour)
  const getVenueSportsAndPrice = (venue) => {
    const sportsList = (venue.sports && venue.sports.length > 0)
      ? venue.sports
      : (venue.sportRates && venue.sportRates.length > 0 ? venue.sportRates.map(sr => sr.sport) : []);
    if (venue.sportRates && venue.sportRates.length > 0) {
      let minRate = Infinity;
      venue.sportRates.forEach(sr => {
        const r = sr.rates || {};
        [r.morning, r.afternoon, r.evening, r.default].forEach(v => {
          if (typeof v === 'number' && v > 0 && v < minRate) minRate = v;
        });
      });
      return { sportsList, price: minRate === Infinity ? null : minRate };
    }
    return {
      sportsList,
      price: venue.pricePerHour != null ? venue.pricePerHour : null
    };
  };

  return (
    <div className="venues-container">
      <div className="venues-header">
        <div className="page-title-with-logo">
          <img src="/logo.png" alt="Sportza" className="page-logo" />
          <h1>Venues in Pune</h1>
        </div>
        <div className="filters">
          <select
            value={filters.sport}
            onChange={(e) => setFilters({ ...filters, sport: e.target.value })}
          >
            <option value="">All Sports</option>
            {sports.map(sport => (
              <option key={sport} value={sport}>{sport.charAt(0).toUpperCase() + sport.slice(1)}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search venues..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading venues...</div>
      ) : venues.length === 0 ? (
        <div className="no-venues">No venues found</div>
      ) : (
        <div className="venues-grid">
          {venues.map(venue => {
            const { sportsList, price } = getVenueSportsAndPrice(venue);
            const sportLabel = sportsList.length ? sportsList.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') : '—';
            const icon = sportsList[0] === 'cricket' ? '🏏' : sportsList[0] === 'football' ? '⚽' : sportsList[0] === 'basketball' ? '🏀' : sportsList[0] === 'tennis' ? '🎾' : sportsList[0] === 'badminton' ? '🏸' : sportsList[0] === 'volleyball' ? '🏐' : '🏟️';
            return (
              <Link key={venue._id} to={`/venues/${venue._id}`} className="venue-card">
                <div className="venue-image">{icon}</div>
                <div className="venue-info">
                  <h3>{venue.name}</h3>
                  <p className="venue-sport">{sportLabel}</p>
                  <p className="venue-location">{venue.location?.address}</p>
                  <p className="venue-price">{price != null ? `From ₹${price}/hr` : '—'}</p>
                  <p className="venue-capacity">Capacity: {venue.capacity} players</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Venues;
