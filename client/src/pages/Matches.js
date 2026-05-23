import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Matches.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Matches = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ sport: '', status: '' });

  useEffect(() => {
    fetchMatches();
  }, [filter]);

  const fetchMatches = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.sport) params.append('sport', filter.sport);
      if (filter.status) params.append('status', filter.status);

      const response = await axios.get(`${API_URL}/matches?${params}`);
      setMatches(response.data);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading matches...</div>;

  return (
    <div className="matches-container">
      <div className="matches-header">
        <div className="page-title-with-logo">
          <img src="/logo.png" alt="Sportza" className="page-logo" />
          <h1>Matches</h1>
        </div>
        <div className="filters">
          <select
            value={filter.sport}
            onChange={(e) => setFilter({ ...filter, sport: e.target.value })}
          >
            <option value="">All Sports</option>
            <option value="cricket">Cricket</option>
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
            <option value="tennis">Tennis</option>
            <option value="badminton">Badminton</option>
            <option value="volleyball">Volleyball</option>
          </select>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="no-matches">
          <p>No matches found</p>
        </div>
      ) : (
        <div className="matches-list">
          {matches.map(match => (
            <Link key={match._id} to={`/matches/${match._id}`} className="match-card">
              <div className="match-header">
                <h3>{match.teams.team1.name} vs {match.teams.team2.name}</h3>
                <span className={`match-status ${match.status}`}>
                  {match.status.replace('_', ' ')}
                </span>
              </div>
              <div className="match-details">
                <p><strong>Sport:</strong> {match.sport}</p>
                <p><strong>Date:</strong> {new Date(match.matchDate).toLocaleDateString()}</p>
                <p><strong>Venue:</strong> {match.venue.name}</p>
                {match.status === 'completed' && (
                  <div className="match-score">
                    <span>{match.scores.team1}</span>
                    <span> - </span>
                    <span>{match.scores.team2}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Matches;
