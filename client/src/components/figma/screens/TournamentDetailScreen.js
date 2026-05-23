import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Trophy, Users, Calendar, MapPin, Play, CheckCircle2, Clock, RefreshCw, ChevronRight, Shield } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const FORMAT_LABELS = {
  league: 'League', round_robin: 'Round Robin', knockout: 'Knockout',
  group_knockout: 'Group + Knockout', other: 'Other',
};
const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  published: { label: 'Published', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  in_progress: { label: 'Live', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  completed: { label: 'Completed', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};
const SPORT_ICONS = {
  cricket: '🏏', football: '⚽', badminton: '🏸', tennis: '🎾',
  basketball: '🏀', volleyball: '🏐', 'table tennis': '🏓', pickleball: '🏓',
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TournamentDetailScreen({ tournament: initialTournament, onBack, onUpdateScore }) {
  const [tournament, setTournament] = useState(initialTournament);
  const [standings, setStandings] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const tournamentId = tournament?._id;
  const format = tournament?.format;
  const status = STATUS_CONFIG[tournament?.status] || STATUS_CONFIG.draft;

  const fetchData = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        axios.get(`${API_URL}/tournaments/${tournamentId}`),
        axios.get(`${API_URL}/tournaments/${tournamentId}/standings`),
      ]);
      setTournament(tRes.data);
      setStandings(sRes.data);
    } catch {
      /* keep initial data */
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (newStatus) => {
    if (!tournamentId) return;
    setActionLoading(true);
    try {
      if (newStatus === 'cancelled') {
        await axios.put(`${API_URL}/tournaments/${tournamentId}/cancel`);
      } else {
        await axios.put(`${API_URL}/tournaments/${tournamentId}`, { status: newStatus });
      }
      fetchData();
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  const tabs = ['overview'];
  if (format === 'league' || format === 'round_robin') tabs.push('standings');
  if (format === 'knockout' || format === 'group_knockout') tabs.push('bracket');
  if (format === 'group_knockout') tabs.push('groups');
  tabs.push('matches', 'teams');

  const TAB_LABELS = {
    overview: 'Overview', standings: 'Standings', bracket: 'Bracket',
    groups: 'Groups', matches: 'Matches', teams: 'Teams',
  };

  const t = tournament || {};
  const icon = SPORT_ICONS[t.sport?.toLowerCase()] || '🏅';
  const venueName = t.venue?.name || t.location?.city || t.place?.name || '';

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0, flex: 1 }}>Tournament</span>
        <button type="button" onClick={fetchData} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#94A3B8' }}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Header Card */}
      <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(59,130,246,0.3))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{t.name || 'Tournament'}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 12, fontWeight: 500 }}>
                {FORMAT_LABELS[format] || format}
              </span>
              <span style={{ padding: '3px 10px', borderRadius: 999, background: status.bg, color: status.color, fontSize: 12, fontWeight: 600 }}>
                {status.label}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, color: '#94A3B8', fontSize: 13 }}>
          {venueName && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {venueName}</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={13} /> {t.teams?.length || 0} teams</span>
          {t.startDate && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={13} /> {formatDate(t.startDate)}</span>}
        </div>

        {t.winner?.name && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Trophy size={20} color="#F59E0B" />
            <div>
              <div style={{ color: '#F59E0B', fontSize: 14, fontWeight: 700 }}>Champion: {t.winner.name}</div>
              {t.runnerUp?.name && <div style={{ color: '#94A3B8', fontSize: 12 }}>Runner-up: {t.runnerUp.name}</div>}
            </div>
          </div>
        )}

        {/* Status Actions */}
        {(t.status === 'draft' || t.status === 'published') && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {t.status === 'draft' && (
              <button type="button" className="figma-btn-primary" style={{ flex: 1, fontSize: 13 }}
                disabled={actionLoading} onClick={() => handleStatusChange('published')}>
                Publish
              </button>
            )}
            {t.status === 'published' && (
              <button type="button" className="figma-btn-primary" style={{ flex: 1, fontSize: 13, background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                disabled={actionLoading} onClick={() => handleStatusChange('in_progress')}>
                <Play size={14} style={{ marginRight: 4 }} /> Start Tournament
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {tabs.map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', background: activeTab === tab ? '#8B5CF6' : 'var(--figma-card)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab tournament={t} standings={standings} />}
      {activeTab === 'standings' && <StandingsTab standings={standings} />}
      {activeTab === 'bracket' && <BracketTab standings={standings} />}
      {activeTab === 'groups' && <GroupsTab standings={standings} />}
      {activeTab === 'matches' && <MatchesTab standings={standings} tournament={t} onUpdateScore={onUpdateScore} />}
      {activeTab === 'teams' && <TeamsTab tournament={t} />}
    </div>
  );
}

// ==================== TAB COMPONENTS ====================

function OverviewTab({ tournament, standings }) {
  const t = tournament || {};
  const format = t.format;

  const quickStats = [];
  if (standings?.standings) {
    const leader = standings.standings[0];
    if (leader) quickStats.push({ label: 'Leader', value: leader.name, sub: `${leader.points} pts` });
    const totalMatches = standings.standings.reduce((s, t) => s + t.played, 0) / 2;
    quickStats.push({ label: 'Matches Played', value: String(Math.round(totalMatches)) });
  }
  if (standings?.bracket) {
    const totalBracket = standings.bracket.reduce((s, r) => s + r.matches.length, 0);
    const completed = standings.bracket.reduce((s, r) => s + r.matches.filter(m => m.isCompleted).length, 0);
    quickStats.push({ label: 'Progress', value: `${completed}/${totalBracket}`, sub: 'matches' });
    const currentRound = standings.bracket.find(r => r.matches.some(m => !m.isCompleted));
    if (currentRound) quickStats.push({ label: 'Current Stage', value: currentRound.name });
  }

  return (
    <div>
      {t.description && (
        <div className="figma-card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>Description</div>
          <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.5 }}>{t.description}</div>
        </div>
      )}

      {quickStats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(quickStats.length, 3)}, 1fr)`, gap: 10, marginBottom: 16 }}>
          {quickStats.map((s, i) => (
            <div key={i} className="figma-card" style={{ padding: 14, textAlign: 'center' }}>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{s.value}</div>
              <div style={{ color: '#94A3B8', fontSize: 12 }}>{s.label}</div>
              {s.sub && <div style={{ color: '#64748B', fontSize: 11 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="figma-card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 10 }}>Scoring Rules</div>
        {(format === 'league' || format === 'round_robin') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ScoringRule label="Win" value="3 points" color="#22C55E" />
            <ScoringRule label="Draw" value="1 point" color="#F59E0B" />
            <ScoringRule label="Loss" value="0 points" color="#EF4444" />
            <div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>Tiebreaker: Goal Difference → Goals For</div>
          </div>
        )}
        {format === 'knockout' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ScoringRule label="Win" value="Advance" color="#22C55E" />
            <ScoringRule label="Loss" value="Eliminated" color="#EF4444" />
            <div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>Single elimination. Only match result matters.</div>
          </div>
        )}
        {format === 'group_knockout' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Group Stage</div>
            <ScoringRule label="Win" value="3 points" color="#22C55E" />
            <ScoringRule label="Draw" value="1 point" color="#F59E0B" />
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>Knockout Stage</div>
            <ScoringRule label="Win" value="Advance" color="#22C55E" />
            <ScoringRule label="Loss" value="Eliminated" color="#EF4444" />
          </div>
        )}
        {format === 'other' && (
          <div style={{ color: '#94A3B8', fontSize: 13 }}>Custom tournament format</div>
        )}
      </div>
    </div>
  );
}

function ScoringRule({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ color: '#fff', fontSize: 14 }}>{label}</span>
      <span style={{ color, fontSize: 14, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function StandingsTab({ standings }) {
  const table = standings?.standings;
  if (!table || table.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No standings data yet. Play some matches first.</div>;
  }

  return (
    <div>
      <div className="figma-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--figma-border)' }}>
                {['#', 'Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'].map(h => (
                  <th key={h} style={{ padding: '12px 8px', color: '#94A3B8', fontSize: 11, fontWeight: 600, textAlign: h === 'Team' ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((team, i) => (
                <tr key={team.index} style={{ borderBottom: i < table.length - 1 ? '1px solid var(--figma-border)' : 'none' }}>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: i < 2 ? '#22C55E' : '#fff', fontWeight: 700, fontSize: 14 }}>{i + 1}</td>
                  <td style={{ padding: '12px 8px', color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Shield size={16} color={i === 0 ? '#F59E0B' : i === 1 ? '#C0C0C0' : '#64748B'} />
                      {team.name}
                    </div>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>{team.played}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: '#22C55E', fontSize: 13, fontWeight: 600 }}>{team.wins}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: '#F59E0B', fontSize: 13 }}>{team.draws}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: '#EF4444', fontSize: 13 }}>{team.losses}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>{team.goalsFor}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>{team.goalsAgainst}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: team.goalDifference > 0 ? '#22C55E' : team.goalDifference < 0 ? '#EF4444' : '#94A3B8', fontSize: 13, fontWeight: 600 }}>
                    {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: 700 }}>{team.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BracketTab({ standings }) {
  const bracket = standings?.bracket;
  if (!bracket || bracket.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No bracket data yet. Generate fixtures first.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {bracket.map(round => (
        <div key={round.round}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ height: 2, flex: 1, background: 'linear-gradient(to right, #8B5CF6, transparent)' }} />
            <span style={{ color: '#8B5CF6', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{round.name}</span>
            <div style={{ height: 2, flex: 1, background: 'linear-gradient(to left, #8B5CF6, transparent)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {round.matches.map((m, i) => (
              <BracketMatch key={m._id || i} match={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BracketMatch({ match }) {
  const isComplete = match.isCompleted;
  const t1Won = match.winner === 'team1';
  const t2Won = match.winner === 'team2';

  return (
    <div className="figma-card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--figma-border)', background: t1Won ? 'rgba(34,197,94,0.06)' : 'transparent' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          {t1Won && <CheckCircle2 size={14} color="#22C55E" />}
          <span style={{ color: t1Won ? '#22C55E' : '#fff', fontSize: 14, fontWeight: t1Won ? 700 : 500 }}>{match.team1Label || 'TBD'}</span>
        </div>
        <span style={{ color: isComplete ? '#fff' : '#64748B', fontSize: 18, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>
          {match.score1 != null ? match.score1 : '-'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: t2Won ? 'rgba(34,197,94,0.06)' : 'transparent' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          {t2Won && <CheckCircle2 size={14} color="#22C55E" />}
          <span style={{ color: t2Won ? '#22C55E' : '#fff', fontSize: 14, fontWeight: t2Won ? 700 : 500 }}>{match.team2Label || 'TBD'}</span>
        </div>
        <span style={{ color: isComplete ? '#fff' : '#64748B', fontSize: 18, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>
          {match.score2 != null ? match.score2 : '-'}
        </span>
      </div>
      {!isComplete && match.team1Label !== 'TBD' && match.team2Label !== 'TBD' && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--figma-border)', textAlign: 'center' }}>
          <span style={{ color: '#3B82F6', fontSize: 12, fontWeight: 600 }}>
            <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Pending
          </span>
        </div>
      )}
    </div>
  );
}

function GroupsTab({ standings }) {
  const groups = standings?.groupStandings;
  if (!groups || Object.keys(groups).length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No group standings yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Object.entries(groups).map(([groupIdx, table]) => (
        <div key={groupIdx}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Group {String.fromCharCode(65 + parseInt(groupIdx, 10))}</h3>
          <div className="figma-card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--figma-border)' }}>
                    {['#', 'Team', 'P', 'W', 'D', 'L', 'GD', 'Pts'].map(h => (
                      <th key={h} style={{ padding: '10px 6px', color: '#94A3B8', fontSize: 11, fontWeight: 600, textAlign: h === 'Team' ? 'left' : 'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.map((team, i) => (
                    <tr key={team.index} style={{ borderBottom: i < table.length - 1 ? '1px solid var(--figma-border)' : 'none' }}>
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#fff', fontWeight: 600, fontSize: 13 }}>{i + 1}</td>
                      <td style={{ padding: '10px 6px', color: '#fff', fontSize: 13, fontWeight: 500 }}>{team.name}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>{team.played}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#22C55E', fontSize: 12 }}>{team.wins}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#F59E0B', fontSize: 12 }}>{team.draws}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#EF4444', fontSize: 12 }}>{team.losses}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: team.goalDifference >= 0 ? '#22C55E' : '#EF4444', fontSize: 12, fontWeight: 600 }}>
                        {team.goalDifference > 0 ? '+' : ''}{team.goalDifference}
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>{team.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchesTab({ standings, tournament, onUpdateScore }) {
  const fixtures = standings?.fixtures || [];
  const matches = standings?.matches || [];

  const completed = fixtures.filter(f => f.status === 'completed');
  const pending = fixtures.filter(f => f.status !== 'completed');

  const renderFixture = (f) => {
    const match = f.match || matches.find(m => m._id?.toString() === f.match?.toString());
    const isComplete = f.status === 'completed';
    return (
      <div key={f._id} className="figma-card" style={{ padding: 14, cursor: !isComplete ? 'pointer' : 'default' }}
        onClick={() => !isComplete && onUpdateScore && onUpdateScore(f, tournament)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: '#94A3B8', fontSize: 12 }}>Round {f.round} &bull; Match {f.matchOrder}</span>
          <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
            background: isComplete ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
            color: isComplete ? '#22C55E' : '#3B82F6' }}>
            {isComplete ? 'Completed' : 'Pending'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600, flex: 1 }}>{f.team1Label || 'TBD'}</span>
          <span style={{ color: '#64748B', fontSize: 13, padding: '0 12px' }}>vs</span>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600, flex: 1, textAlign: 'right' }}>{f.team2Label || 'TBD'}</span>
        </div>
        {!isComplete && f.team1Label !== 'TBD' && f.team2Label !== 'TBD' && (
          <div style={{ marginTop: 8, textAlign: 'center' }}>
            <span style={{ color: '#3B82F6', fontSize: 12, fontWeight: 600 }}>Tap to update score →</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} color="#3B82F6" /> Upcoming Matches ({pending.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pending.map(renderFixture)}
          </div>
        </div>
      )}
      {completed.length > 0 && (
        <div>
          <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} color="#22C55E" /> Completed ({completed.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {completed.map(renderFixture)}
          </div>
        </div>
      )}
      {fixtures.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No fixtures generated yet.</div>
      )}
    </div>
  );
}

function TeamsTab({ tournament }) {
  const teams = tournament?.teams || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {teams.map((team, i) => (
        <div key={i} className="figma-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: team.players?.length > 0 ? 10 : 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="#3B82F6" />
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{team.name}</div>
              <div style={{ color: '#94A3B8', fontSize: 12 }}>{team.players?.length || 0} players</div>
            </div>
          </div>
          {team.players?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 50 }}>
              {team.players.map((p, j) => (
                <span key={j} style={{ padding: '4px 10px', borderRadius: 999, background: 'var(--figma-card)', color: '#94A3B8', fontSize: 12 }}>
                  {typeof p === 'object' ? p.name : p}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      {teams.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>No teams registered yet.</div>
      )}
    </div>
  );
}
