import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Trophy, Users, ListOrdered, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const FORMAT_OPTIONS = [
  { value: 'league', label: 'League' },
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'knockout', label: 'Knockout (4, 8, or 16 teams)' },
  { value: 'group_knockout', label: 'Group + Knockout' },
  { value: 'other', label: 'Other' },
];

const FALLBACK_SPORTS = [
  { _id: 'fb_cricket', name: 'cricket', displayName: 'Cricket', icon: '🏏', formats: [
    { name: '11-a-side', playersPerTeam: 11, description: 'Standard 11 players per side' },
    { name: '6-a-side', playersPerTeam: 6, description: '6 players per side' },
  ]},
  { _id: 'fb_football', name: 'football', displayName: 'Football', icon: '⚽', formats: [
    { name: '11-a-side', playersPerTeam: 11, description: 'Standard 11v11' },
    { name: '5-a-side', playersPerTeam: 5, description: '5v5' },
    { name: '7-a-side', playersPerTeam: 7, description: '7v7' },
  ]},
  { _id: 'fb_badminton', name: 'badminton', displayName: 'Badminton', icon: '🏸', formats: [
    { name: 'singles', playersPerTeam: 1, description: '1v1' },
    { name: 'doubles', playersPerTeam: 2, description: '2v2' },
  ]},
  { _id: 'fb_tennis', name: 'tennis', displayName: 'Tennis', icon: '🎾', formats: [
    { name: 'singles', playersPerTeam: 1, description: '1v1' },
    { name: 'doubles', playersPerTeam: 2, description: '2v2' },
  ]},
  { _id: 'fb_basketball', name: 'basketball', displayName: 'Basketball', icon: '🏀', formats: [
    { name: '5-a-side', playersPerTeam: 5, description: '5v5' },
    { name: '3v3', playersPerTeam: 3, description: '3v3' },
  ]},
  { _id: 'fb_volleyball', name: 'volleyball', displayName: 'Volleyball', icon: '🏐', formats: [
    { name: '6-a-side', playersPerTeam: 6, description: '6v6' },
    { name: 'beach doubles', playersPerTeam: 2, description: '2v2 beach' },
  ]},
  { _id: 'fb_tabletennis', name: 'table tennis', displayName: 'Table Tennis', icon: '🏓', formats: [
    { name: 'singles', playersPerTeam: 1, description: '1v1' },
    { name: 'doubles', playersPerTeam: 2, description: '2v2' },
  ]},
  { _id: 'fb_pickleball', name: 'pickleball', displayName: 'Pickleball', icon: '🏓', formats: [
    { name: 'singles', playersPerTeam: 1, description: '1v1' },
    { name: 'doubles', playersPerTeam: 2, description: '2v2' },
  ]},
];

const SPORT_ICONS = { cricket: '🏏', football: '⚽', badminton: '🏸', tennis: '🎾', basketball: '🏀', volleyball: '🏐', 'table tennis': '🏓', pickleball: '🏓', padel: '🎾', hockey: '🏑', kabaddi: '🤼', swimming: '🏊' };

const DEFAULT_STAGE = { stageOrder: 1, name: '', format: 'round_robin', groupCount: undefined, advancePerGroup: undefined, bestOf: undefined };

export function CreateTournamentFlow({ onBack, onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sports, setSports] = useState([]);
  const [venues, setVenues] = useState([]);

  // Step 1: tournament details
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('');
  const [matchFormatName, setMatchFormatName] = useState('');
  const [format, setFormat] = useState('league');
  const [venueId, setVenueId] = useState('');
  const [maxTeams, setMaxTeams] = useState(8);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useStages, setUseStages] = useState(false);
  const [stages, setStages] = useState([{ ...DEFAULT_STAGE }]);

  // Step 2: teams
  const [teams, setTeams] = useState([{ name: '', players: [] }]);
  const [tournamentId, setTournamentId] = useState(null);
  const [tournament, setTournament] = useState(null);

  // Step 3/4: fixtures
  const [fixtures, setFixtures] = useState([]);
  const [fixturesGenerated, setFixturesGenerated] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [sportsRes, venuesRes] = await Promise.all([
          axios.get(`${API_URL}/sports`),
          axios.get(`${API_URL}/venues`),
        ]);
        const sportList = Array.isArray(sportsRes.data) ? sportsRes.data : sportsRes.data?.sports || [];
        setSports(sportList.length > 0 ? sportList : FALLBACK_SPORTS);
        setVenues(Array.isArray(venuesRes.data) ? venuesRes.data : venuesRes.data?.venues || []);
      } catch (e) {
        console.warn('Fetch sports/venues:', e);
        setSports(FALLBACK_SPORTS);
        setVenues([]);
      }
    };
    fetchOptions();
  }, []);

  const selectedSportObj = useMemo(
    () => sports.find((s) => s.name === sport) || null,
    [sports, sport]
  );

  const sportFormats = useMemo(
    () => (selectedSportObj?.formats || []),
    [selectedSportObj]
  );

  useEffect(() => {
    if (sportFormats.length > 0 && !sportFormats.find((f) => f.name === matchFormatName)) {
      setMatchFormatName(sportFormats[0]?.name || '');
    }
  }, [sportFormats, matchFormatName]);

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Tournament name is required');
      return;
    }
    if (!sport) {
      toast.error('Please select a sport');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        sport: typeof sport === 'string' ? sport : sport?.name || sport,
        format: useStages && stages.length ? stages[0].format : format,
        matchFormatName: matchFormatName || undefined,
        maxTeams: maxTeams >= 2 ? maxTeams : undefined,
        venue: venueId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      if (useStages && stages.length) {
        payload.stages = stages
          .filter((s) => s.format)
          .map((s, i) => ({
            stageOrder: i + 1,
            name: s.name?.trim() || `Stage ${i + 1}`,
            format: s.format,
            groupCount: s.groupCount >= 1 ? s.groupCount : undefined,
            advancePerGroup: s.advancePerGroup >= 1 ? s.advancePerGroup : undefined,
            bestOf: s.bestOf >= 1 ? s.bestOf : undefined,
          }));
      }
      const res = await axios.post(`${API_URL}/tournaments`, payload);
      setTournament(res.data);
      setTournamentId(res.data._id);
      setStep(2);
      toast.success('Tournament created');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  const addTeam = () => {
    setTeams((prev) => [...prev, { name: '', players: [] }]);
  };

  const removeTeam = (index) => {
    if (teams.length <= 1) return;
    setTeams((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTeamName = (index, value) => {
    setTeams((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: value };
      return next;
    });
  };

  const handleRegisterTeams = async (e) => {
    e.preventDefault();
    const valid = teams.filter((t) => t.name.trim());
    if (valid.length < 2) {
      toast.error('Add at least 2 teams');
      return;
    }
    if (format === 'knockout') {
      const n = valid.length;
      const isPowerOf2 = n > 0 && (n & (n - 1)) === 0;
      if (!isPowerOf2) {
        toast.error('Knockout requires 4, 8, or 16 teams');
        return;
      }
    }
    setLoading(true);
    try {
      const payload = {
        teams: valid.map((t) => ({ name: t.name.trim(), players: t.players || [] })),
        maxTeams: maxTeams >= 2 ? maxTeams : undefined,
      };
      await axios.put(`${API_URL}/tournaments/${tournamentId}/teams`, payload);
      setStep(3);
      toast.success('Teams registered');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register teams');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFixtures = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/tournaments/${tournamentId}/generate-fixtures`);
      setFixturesGenerated(true);
      const res = await axios.get(`${API_URL}/tournaments/${tournamentId}/fixtures`);
      setFixtures(res.data || []);
      toast.success('Fixtures generated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate fixtures');
    } finally {
      setLoading(false);
    }
  };

  const handleViewFixtures = async () => {
    try {
      const res = await axios.get(`${API_URL}/tournaments/${tournamentId}/fixtures`);
      setFixtures(res.data || []);
      setStep(4);
    } catch (err) {
      toast.error('Failed to load fixtures');
    }
  };

  const handleDone = () => {
    onComplete && onComplete();
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid var(--figma-border)',
    background: 'var(--figma-bg-secondary)',
    color: '#fff',
    fontSize: 16,
  };
  const labelStyle = { display: 'block', color: '#94A3B8', fontSize: 14, fontWeight: 500, marginBottom: 6 };

  return (
    <div className="figma-page" style={{ paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          onClick={step === 1 ? onBack : () => setStep(step - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}
        >
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>
          {step === 1 && 'Create Tournament'}
          {step === 2 && 'Register Teams'}
          {step === 3 && 'Generate Fixtures'}
          {step === 4 && 'Fixtures'}
        </span>
      </div>

      {step === 1 && (
        <form onSubmit={handleCreateTournament}>
          <div className="figma-card" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Tournament name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Badminton Cup"
                style={inputStyle}
                required
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                style={{ ...inputStyle, minHeight: 80 }}
                rows={3}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Sport *</label>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {sports.map((s) => {
                  const icon = SPORT_ICONS[(s.name || '').toLowerCase()] || s.icon || '🏅';
                  const isActive = sport === s.name;
                  return (
                    <button
                      key={s._id || s.name}
                      type="button"
                      onClick={() => setSport(s.name)}
                      style={{
                        flexShrink: 0, padding: '10px 14px', borderRadius: 14, cursor: 'pointer',
                        border: isActive ? '2px solid #3B82F6' : '1px solid var(--figma-border)',
                        background: isActive ? 'rgba(59,130,246,0.15)' : 'var(--figma-card)',
                        color: '#fff', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      {s.displayName || s.name}
                    </button>
                  );
                })}
              </div>
              {sports.length === 0 && (
                <div style={{ color: '#94A3B8', fontSize: 13, marginTop: 8 }}>Loading sports...</div>
              )}
            </div>

            {sportFormats.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Match Format *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {sportFormats.map((f) => {
                    const isActive = matchFormatName === f.name;
                    return (
                      <button
                        key={f.name}
                        type="button"
                        onClick={() => setMatchFormatName(f.name)}
                        style={{
                          padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
                          border: isActive ? '2px solid #3B82F6' : '1px solid var(--figma-border)',
                          background: isActive ? 'rgba(59,130,246,0.15)' : 'var(--figma-card)',
                          color: '#fff', fontSize: 14, fontWeight: 500,
                        }}
                      >
                        <div>{f.name}</div>
                        <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                          {f.playersPerTeam ? `${f.playersPerTeam} per team` : f.description || ''}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Tournament Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} style={inputStyle}>
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Venue (optional)</label>
              <select value={venueId} onChange={(e) => setVenueId(e.target.value)} style={inputStyle}>
                <option value="">No venue / custom location</option>
                {venues.map((v) => (
                  <option key={v._id} value={v._id}>{v.name} {v.location?.city ? `— ${v.location.city}` : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Max teams</label>
              <input
                type="number"
                min={2}
                max={32}
                value={maxTeams}
                onChange={(e) => setMaxTeams(parseInt(e.target.value, 10) || 2)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#94A3B8', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={useStages}
                  onChange={(e) => {
                    setUseStages(e.target.checked);
                    if (e.target.checked && stages.length === 0) setStages([{ ...DEFAULT_STAGE }]);
                  }}
                />
                Different format per stage (e.g. groups → knockout → best-of-3 final)
              </label>
            </div>
            {useStages && (
              <div className="figma-card" style={{ padding: 16, marginBottom: 16, background: 'var(--figma-bg-secondary)' }}>
                <h4 style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>Stages</h4>
                {stages.map((s, idx) => (
                  <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: idx < stages.length - 1 ? '1px solid var(--figma-border)' : 'none' }}>
                    <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>Stage {idx + 1}</div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => setStages((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], name: e.target.value };
                          return next;
                        })}
                        placeholder="e.g. Group stage"
                        style={{ ...inputStyle, marginBottom: 0 }}
                      />
                      <select
                        value={s.format}
                        onChange={(e) => setStages((prev) => {
                          const next = [...prev];
                          next[idx] = { ...next[idx], format: e.target.value };
                          return next;
                        })}
                        style={inputStyle}
                      >
                        {FORMAT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {(s.format === 'round_robin' || s.format === 'group_knockout') && (
                        <>
                          <input
                            type="number"
                            min={1}
                            placeholder="Groups (optional)"
                            value={s.groupCount ?? ''}
                            onChange={(e) => setStages((prev) => {
                              const next = [...prev];
                              const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                              next[idx] = { ...next[idx], groupCount: v };
                              return next;
                            })}
                            style={inputStyle}
                          />
                          <input
                            type="number"
                            min={1}
                            placeholder="Advance per group (optional)"
                            value={s.advancePerGroup ?? ''}
                            onChange={(e) => setStages((prev) => {
                              const next = [...prev];
                              const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                              next[idx] = { ...next[idx], advancePerGroup: v };
                              return next;
                            })}
                            style={inputStyle}
                          />
                        </>
                      )}
                      <input
                        type="number"
                        min={1}
                        placeholder="Best of N (e.g. 3 for final)"
                        value={s.bestOf ?? ''}
                        onChange={(e) => setStages((prev) => {
                          const next = [...prev];
                          const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                          next[idx] = { ...next[idx], bestOf: v };
                          return next;
                        })}
                        style={inputStyle}
                      />
                    </div>
                    {stages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setStages((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ marginTop: 8, padding: '6px 12px', fontSize: 12, background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 8, color: '#EF4444', cursor: 'pointer' }}
                      >
                        Remove stage
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setStages((prev) => [...prev, { ...DEFAULT_STAGE, stageOrder: prev.length + 1, format: 'knockout' }])}
                  style={{ width: '100%', padding: 10, border: '1px dashed var(--figma-border)', borderRadius: 8, background: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 14 }}
                >
                  + Add stage
                </button>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Start date (optional)</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 0 }}>
              <label style={labelStyle}>End date (optional)</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <button type="submit" className="figma-btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating…' : 'Create & continue'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleRegisterTeams}>
          <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 16 }}>
            Add team names. {format === 'knockout' && 'Knockout requires 4, 8, or 16 teams.'}
          </p>
          <div className="figma-card" style={{ padding: 20, marginBottom: 20 }}>
            {teams.map((team, index) => (
              <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                <input
                  type="text"
                  value={team.name}
                  onChange={(e) => updateTeamName(index, e.target.value)}
                  placeholder={`Team ${index + 1}`}
                  style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={() => removeTeam(index)}
                  disabled={teams.length <= 1}
                  style={{
                    padding: 12,
                    background: 'rgba(239,68,68,0.15)',
                    border: 'none',
                    borderRadius: 12,
                    color: '#EF4444',
                    cursor: teams.length > 1 ? 'pointer' : 'not-allowed',
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTeam}
              style={{
                width: '100%',
                padding: 12,
                border: '1px dashed var(--figma-border)',
                borderRadius: 12,
                background: 'transparent',
                color: '#94A3B8',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              + Add team
            </button>
          </div>
          <button type="submit" className="figma-btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Saving…' : 'Register teams & continue'}
          </button>
        </form>
      )}

      {step === 3 && (
        <div>
          <div className="figma-card" style={{ padding: 24, marginBottom: 20, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <ListOrdered size={28} color="#22C55E" />
            </div>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Generate fixture schedule</h3>
            <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 16 }}>
              Create all match slots from the registered teams. You can then schedule and play matches.
            </p>
            {!fixturesGenerated ? (
              <button
                type="button"
                onClick={handleGenerateFixtures}
                className="figma-btn-primary"
                style={{ width: '100%' }}
                disabled={loading}
              >
                {loading ? 'Generating…' : 'Generate fixtures'}
              </button>
            ) : (
              <div>
                <p style={{ color: '#22C55E', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                  <CheckCircle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Fixtures generated
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button type="button" onClick={handleViewFixtures} className="figma-btn-primary" style={{ flex: 1, minWidth: 120 }}>
                    View fixtures
                  </button>
                  <button
                    type="button"
                    onClick={handleDone}
                    style={{
                      flex: 1,
                      minWidth: 120,
                      padding: '12px 20px',
                      borderRadius: 12,
                      border: '1px solid var(--figma-border)',
                      background: 'transparent',
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="figma-card" style={{ padding: 20, marginBottom: 20 }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Fixture list</h3>
            {fixtures.length === 0 ? (
              <p style={{ color: '#94A3B8', fontSize: 14 }}>No fixtures yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {fixtures.map((f, i) => (
                  <li
                    key={f._id || i}
                    style={{
                      padding: '12px 0',
                      borderBottom: i < fixtures.length - 1 ? '1px solid var(--figma-border)' : 'none',
                      color: '#fff',
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: '#94A3B8', marginRight: 8 }}>R{f.round} M{f.matchOrder}</span>
                    {f.team1Label || 'TBD'} vs {f.team2Label || 'TBD'}
                    {f.status && <span style={{ marginLeft: 8, color: '#64748B', fontSize: 12 }}>({f.status})</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" onClick={handleDone} className="figma-btn-primary" style={{ width: '100%' }}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
