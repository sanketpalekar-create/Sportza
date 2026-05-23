import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './MatchDetail.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const MatchDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatch();
  }, [id]);

  const fetchMatch = async () => {
    try {
      const response = await axios.get(`${API_URL}/matches/${id}`);
      setMatch(response.data);
      setScores(response.data.scores || { team1: 0, team2: 0 });
    } catch (error) {
      toast.error('Error loading match');
    } finally {
      setLoading(false);
    }
  };

  const updateScores = async () => {
    try {
      await axios.put(`${API_URL}/matches/${id}/scores`, { scores });
      toast.success('Scores updated');
      fetchMatch();
    } catch (error) {
      toast.error('Error updating scores');
    }
  };

  const completeMatch = async () => {
    if (!window.confirm('Complete this match? This will update player stats.')) return;

    try {
      await axios.put(`${API_URL}/matches/${id}/complete`);
      toast.success('Match completed! Stats updated.');
      fetchMatch();
    } catch (error) {
      toast.error('Error completing match');
    }
  };

  if (loading) return <div className="loading">Loading match...</div>;
  if (!match) return <div>Match not found</div>;

  return (
    <div className="match-detail-container">
      <div className="match-detail">
        <div className="match-header">
          <img src="/logo.png" alt="Sportza" className="page-logo match-detail-logo" />
          <div>
            <h1>{match.teams.team1.name} vs {match.teams.team2.name}</h1>
            <span className={`match-status ${match.status}`}>
            {match.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="match-info">
          <p><strong>Sport:</strong> {match.sport}</p>
          <p><strong>Date:</strong> {new Date(match.matchDate).toLocaleDateString()}</p>
          <p><strong>Venue:</strong> {match.venue.name}</p>
          <p><strong>Location:</strong> {match.venue.location.address}</p>
        </div>

        <div className="teams-section">
          <div className="team">
            <h3>Team 1: {match.teams.team1.name}</h3>
            <ul>
              {match.teams.team1.players.map(player => (
                <li key={player._id}>{player.name}</li>
              ))}
            </ul>
          </div>
          <div className="team">
            <h3>Team 2: {match.teams.team2.name}</h3>
            <ul>
              {match.teams.team2.players.map(player => (
                <li key={player._id}>{player.name}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="scores-section">
          <h3>Score</h3>
          {match.status === 'completed' ? (
            <div className="final-score">
              <div className="score-box">
                <span className="team-name">{match.teams.team1.name}</span>
                <span className="score">{match.scores.team1}</span>
              </div>
              <span className="vs">VS</span>
              <div className="score-box">
                <span className="team-name">{match.teams.team2.name}</span>
                <span className="score">{match.scores.team2}</span>
              </div>
            </div>
          ) : (
            <div className="score-input">
              <div className="score-control">
                <label>{match.teams.team1.name}</label>
                <input
                  type="number"
                  value={scores.team1}
                  onChange={(e) => setScores({ ...scores, team1: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
              <span className="vs">VS</span>
              <div className="score-control">
                <label>{match.teams.team2.name}</label>
                <input
                  type="number"
                  value={scores.team2}
                  onChange={(e) => setScores({ ...scores, team2: parseInt(e.target.value) || 0 })}
                  min="0"
                />
              </div>
            </div>
          )}

          {match.status !== 'completed' && (
            <div className="score-actions">
              <button onClick={updateScores} className="btn-update">
                Update Scores
              </button>
              {match.status === 'in_progress' && (
                <button onClick={completeMatch} className="btn-complete">
                  Complete Match
                </button>
              )}
            </div>
          )}
        </div>

        {match.playerStats && match.playerStats.length > 0 && (
          <div className="player-stats-section">
            <h3>Player Statistics</h3>
            <div className="stats-grid">
              {match.playerStats.map((stat, idx) => (
                <div key={idx} className="stat-card">
                  <h4>{stat.player.name}</h4>
                  <div className="stat-details">
                    {match.sport === 'cricket' && (
                      <>
                        <p>Runs: {stat.stats.runs || 0}</p>
                        <p>Wickets: {stat.stats.wickets || 0}</p>
                      </>
                    )}
                    {match.sport === 'football' && (
                      <>
                        <p>Goals: {stat.stats.goals || 0}</p>
                        <p>Assists: {stat.stats.assists || 0}</p>
                      </>
                    )}
                    {match.sport === 'basketball' && (
                      <>
                        <p>Points: {stat.stats.points || 0}</p>
                        <p>Rebounds: {stat.stats.rebounds || 0}</p>
                        <p>Assists: {stat.stats.assists || 0}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchDetail;
