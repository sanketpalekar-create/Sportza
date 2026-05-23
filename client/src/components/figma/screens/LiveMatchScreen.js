import React, { useState, useEffect } from 'react';
import { ChevronLeft, MapPin, Calendar, Play, Square, RotateCcw } from 'lucide-react';
import { useNav } from '../../../context/NavContext';

const SPORT_SCORE_TYPE = {
  Tennis: 'tennis',
  tennis: 'tennis',
  Badminton: 'badminton',
  badminton: 'badminton',
  Cricket: 'cricket',
  cricket: 'cricket',
  Football: 'football',
  football: 'football',
  Basketball: 'basketball',
  basketball: 'basketball',
};

const DEFAULT_MATCH = {
  id: '1',
  sport: 'Badminton',
  venue: 'Elite Sports Arena',
  location: 'Koregaon Park',
  date: 'Today',
  time: '6:00 PM',
  team1: { name: 'Team A', players: ['You', 'Partner'] },
  team2: { name: 'Team B', players: ['Opp 1', 'Opp 2'] },
  status: 'scheduled',
  scores: null,
};

const TENNIS_POINTS = ['0', '15', '30', '40'];

function TennisScore({ scores, onScore, team1Name, team2Name }) {
  const raw = scores || {};
  const s = {
    sets: Array.isArray(raw.sets) ? raw.sets : [],
    games: raw.games && typeof raw.games.team1 === 'number' ? raw.games : { team1: 0, team2: 0 },
    points: raw.points && typeof raw.points.team1 === 'number' ? raw.points : { team1: 0, team2: 0 },
    serving: raw.serving || 'team1',
  };
  const pointLabels = (p1, p2) => {
    if (p1 >= 3 && p2 >= 3) {
      if (p1 === p2) return ['Deuce', 'Deuce'];
      if (p1 > p2) return ['AD', ''];
      return ['', 'AD'];
    }
    return [TENNIS_POINTS[Math.min(p1, 3)] || '40', TENNIS_POINTS[Math.min(p2, 3)] || '40'];
  };

  const [lbl1, lbl2] = pointLabels(s.points.team1, s.points.team2);
  const isDeuce = lbl1 === 'Deuce';

  const winGame = (winner) => {
    const loser = winner === 'team1' ? 'team2' : 'team1';
    const newGames = { ...s.games, [winner]: s.games[winner] + 1 };
    const newPoints = { team1: 0, team2: 0 };
    const newServing = s.serving === 'team1' ? 'team2' : 'team1';

    if (newGames[winner] >= 6 && newGames[winner] - newGames[loser] >= 2) {
      const newSets = [...s.sets, { ...newGames }];
      onScore('full', { ...s, sets: newSets, games: { team1: 0, team2: 0 }, points: newPoints, serving: newServing });
      return;
    }
    if (newGames[winner] === 7) {
      const newSets = [...s.sets, { ...newGames }];
      onScore('full', { ...s, sets: newSets, games: { team1: 0, team2: 0 }, points: newPoints, serving: newServing });
      return;
    }
    onScore('full', { ...s, games: newGames, points: newPoints, serving: newServing });
  };

  const addPoint = (team) => {
    const other = team === 'team1' ? 'team2' : 'team1';
    const p = { ...s.points, [team]: s.points[team] + 1 };

    if (p[team] >= 4 && p[team] - p[other] >= 2) {
      winGame(team);
      return;
    }
    if (p[team] >= 3 && p[other] >= 3 && p[team] > p[other] + 1) {
      winGame(team);
      return;
    }
    onScore('full', { ...s, points: p });
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="figma-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{team1Name}</div>
            <div style={{ color: '#fff', fontSize: 44, fontWeight: 700 }}>{isDeuce ? '' : lbl1}</div>
            {s.serving === 'team1' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', margin: '6px auto 0' }} />}
          </div>
          <div style={{ textAlign: 'center', padding: '0 12px' }}>
            {isDeuce ? (
              <div style={{ color: '#F59E0B', fontSize: 18, fontWeight: 700 }}>DEUCE</div>
            ) : (
              <div style={{ color: '#64748B', fontSize: 14 }}>Points</div>
            )}
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{team2Name}</div>
            <div style={{ color: '#fff', fontSize: 44, fontWeight: 700 }}>{isDeuce ? '' : lbl2}</div>
            {s.serving === 'team2' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', margin: '6px auto 0' }} />}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <button type="button" className="figma-btn-primary" style={{ flex: 1, height: 48, fontSize: 16 }} onClick={() => addPoint('team1')}>Point {team1Name}</button>
          <button type="button" className="figma-btn-primary" style={{ flex: 1, height: 48, fontSize: 16 }} onClick={() => addPoint('team2')}>Point {team2Name}</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94A3B8', fontSize: 13 }}>Games: {s.games.team1} - {s.games.team2}</span>
        </div>
      </div>

      {s.sets.length > 0 && (
        <div className="figma-card" style={{ padding: 16 }}>
          <div style={{ color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Sets</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4 }}>
            <div style={{ color: '#94A3B8', fontSize: 12 }}>{team1Name}</div>
            <div />
            <div style={{ color: '#94A3B8', fontSize: 12, textAlign: 'right' }}>{team2Name}</div>
            {s.sets.map((set, i) => (
              <React.Fragment key={i}>
                <div style={{ color: set.team1 > set.team2 ? '#22C55E' : '#fff', fontSize: 18, fontWeight: 700 }}>{set.team1}</div>
                <div style={{ color: '#64748B', fontSize: 12, textAlign: 'center', alignSelf: 'center' }}>Set {i + 1}</div>
                <div style={{ color: set.team2 > set.team1 ? '#22C55E' : '#fff', fontSize: 18, fontWeight: 700, textAlign: 'right' }}>{set.team2}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BadmintonScore({ scores, onScore, team1Name, team2Name }) {
  const raw = scores || {};
  const s = {
    sets: Array.isArray(raw.sets) ? raw.sets : [],
    points: raw.points && typeof raw.points.team1 === 'number' ? raw.points : { team1: 0, team2: 0 },
    serving: raw.serving || 'team1',
  };

  const addPoint = (team) => {
    const other = team === 'team1' ? 'team2' : 'team1';
    const p = { ...s.points, [team]: s.points[team] + 1 };
    const newServing = team;

    if ((p[team] >= 21 && p[team] - p[other] >= 2) || p[team] >= 30) {
      const newSets = [...s.sets, { ...p }];
      onScore('full', { ...s, sets: newSets, points: { team1: 0, team2: 0 }, serving: newServing });
      return;
    }
    onScore('full', { ...s, points: p, serving: newServing });
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="figma-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{team1Name}</div>
            <div style={{ color: '#fff', fontSize: 52, fontWeight: 700 }}>{s.points.team1}</div>
            {s.serving === 'team1' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', margin: '6px auto 0' }} />}
          </div>
          <span style={{ color: '#64748B', fontSize: 24, fontWeight: 600 }}>-</span>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{team2Name}</div>
            <div style={{ color: '#fff', fontSize: 52, fontWeight: 700 }}>{s.points.team2}</div>
            {s.serving === 'team2' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', margin: '6px auto 0' }} />}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className="figma-btn-primary" style={{ flex: 1, height: 48, fontSize: 16 }} onClick={() => addPoint('team1')}>+1</button>
          <button type="button" className="figma-btn-primary" style={{ flex: 1, height: 48, fontSize: 16 }} onClick={() => addPoint('team2')}>+1</button>
        </div>
        <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12, marginTop: 8 }}>Game to 21 (win by 2, cap 30)</div>
      </div>
      {s.sets.length > 0 && (
        <div className="figma-card" style={{ padding: 16 }}>
          <div style={{ color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Sets</div>
          {s.sets.map((set, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--figma-border)' }}>
              <span style={{ color: '#fff' }}>Set {i + 1}</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>{set.team1} - {set.team2}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FootballScore({ scores, onScore, team1Name, team2Name }) {
  const s = scores && typeof scores.team1 === 'number' ? scores : { team1: 0, team2: 0, half: 1 };

  const addGoal = (team) => {
    const next = { ...s, [team]: s[team] + 1 };
    onScore('full', next);
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="figma-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 12, fontWeight: 600 }}>
            {s.half === 1 ? '1st Half' : '2nd Half'}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{team1Name}</div>
            <div style={{ color: '#fff', fontSize: 56, fontWeight: 700 }}>{s.team1}</div>
          </div>
          <span style={{ color: '#64748B', fontSize: 24, fontWeight: 600 }}>-</span>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{team2Name}</div>
            <div style={{ color: '#fff', fontSize: 56, fontWeight: 700 }}>{s.team2}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <button type="button" className="figma-btn-primary" style={{ flex: 1, height: 48, fontSize: 15 }} onClick={() => addGoal('team1')}>Goal {team1Name}</button>
          <button type="button" className="figma-btn-primary" style={{ flex: 1, height: 48, fontSize: 15 }} onClick={() => addGoal('team2')}>Goal {team2Name}</button>
        </div>
        <button type="button" className="figma-btn-ghost" style={{ width: '100%' }} onClick={() => onScore('full', { ...s, half: s.half === 1 ? 2 : 1 })}>
          {s.half === 1 ? 'Start 2nd Half' : 'Back to 1st Half'}
        </button>
      </div>
    </div>
  );
}

function BasketballScore({ scores, onScore, team1Name, team2Name }) {
  const s = scores && typeof scores.team1 === 'number' ? scores : { team1: 0, team2: 0, quarter: 1 };
  const QUARTERS = ['1st Qtr', '2nd Qtr', '3rd Qtr', '4th Qtr'];

  const addPoints = (team, pts) => {
    onScore('full', { ...s, [team]: s[team] + pts });
  };

  return (
    <div style={{ padding: 16 }}>
      <div className="figma-card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ padding: '4px 12px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 12, fontWeight: 600 }}>
            {QUARTERS[Math.min(s.quarter - 1, 3)]}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{team1Name}</div>
            <div style={{ color: '#fff', fontSize: 52, fontWeight: 700 }}>{s.team1}</div>
          </div>
          <span style={{ color: '#64748B', fontSize: 24, fontWeight: 600 }}>-</span>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{team2Name}</div>
            <div style={{ color: '#fff', fontSize: 52, fontWeight: 700 }}>{s.team2}</div>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 6, textAlign: 'center' }}>{team1Name}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="figma-btn-primary" style={{ flex: 1 }} onClick={() => addPoints('team1', 1)}>+1 FT</button>
            <button type="button" className="figma-btn-primary" style={{ flex: 1 }} onClick={() => addPoints('team1', 2)}>+2 FG</button>
            <button type="button" className="figma-btn-primary" style={{ flex: 1 }} onClick={() => addPoints('team1', 3)}>+3 PT</button>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 6, textAlign: 'center' }}>{team2Name}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="figma-btn-primary" style={{ flex: 1 }} onClick={() => addPoints('team2', 1)}>+1 FT</button>
            <button type="button" className="figma-btn-primary" style={{ flex: 1 }} onClick={() => addPoints('team2', 2)}>+2 FG</button>
            <button type="button" className="figma-btn-primary" style={{ flex: 1 }} onClick={() => addPoints('team2', 3)}>+3 PT</button>
          </div>
        </div>
        <button type="button" className="figma-btn-ghost" style={{ width: '100%' }} onClick={() => onScore('full', { ...s, quarter: Math.min(s.quarter + 1, 4) })}>
          Next Quarter
        </button>
      </div>
    </div>
  );
}

function CricketScore({ scores, onScore }) {
  const safe = scores || {};
  const inn1 = safe.innings1 || { runs: 0, wickets: 0, overs: 0 };
  const inn2 = safe.innings2 || { runs: 0, wickets: 0, overs: 0 };
  const [edit, setEdit] = useState(null);
  const [runs, setRuns] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [overs, setOvers] = useState(0);

  const apply = (innKey) => {
    onScore(innKey, { runs, wickets, overs });
    setEdit(null);
  };

  const quickRun = (innKey, r) => {
    const inn = innKey === 'innings1' ? inn1 : inn2;
    onScore(innKey, { ...inn, runs: inn.runs + r });
  };

  const quickWicket = (innKey) => {
    const inn = innKey === 'innings1' ? inn1 : inn2;
    if (inn.wickets < 10) onScore(innKey, { ...inn, wickets: inn.wickets + 1 });
  };

  return (
    <div style={{ padding: 16 }}>
      {['innings1', 'innings2'].map((innKey, idx) => {
        const inn = innKey === 'innings1' ? inn1 : inn2;
        return (
          <div key={innKey} className="figma-card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>Innings {idx + 1}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{inn.runs}/{inn.wickets}</span>
              <span style={{ color: '#94A3B8', fontSize: 14 }}>{inn.overs} overs</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {[1, 2, 4, 6].map((r) => (
                <button key={r} type="button" className="figma-btn-primary" style={{ minWidth: 44, fontSize: 13 }} onClick={() => quickRun(innKey, r)}>+{r}</button>
              ))}
              <button type="button" style={{ minWidth: 44, fontSize: 13, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontWeight: 600, padding: '0 10px', height: 40 }} onClick={() => quickWicket(innKey)}>W</button>
              <button type="button" className="figma-btn-ghost" style={{ fontSize: 13 }} onClick={() => { setEdit(innKey); setRuns(inn.runs); setWickets(inn.wickets); setOvers(inn.overs); }}>Edit</button>
            </div>
          </div>
        );
      })}
      {edit && (
        <div className="figma-card" style={{ padding: 16, marginTop: 4 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: '#94A3B8', fontSize: 12, display: 'block', marginBottom: 4 }}>Runs</label>
            <input type="number" min="0" value={runs} onChange={(e) => setRuns(Number(e.target.value))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--figma-border)', background: 'var(--figma-card)', color: '#fff' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: '#94A3B8', fontSize: 12, display: 'block', marginBottom: 4 }}>Wickets</label>
            <input type="number" min="0" max="10" value={wickets} onChange={(e) => setWickets(Number(e.target.value))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--figma-border)', background: 'var(--figma-card)', color: '#fff' }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ color: '#94A3B8', fontSize: 12, display: 'block', marginBottom: 4 }}>Overs</label>
            <input type="number" min="0" step="0.1" value={overs} onChange={(e) => setOvers(Number(e.target.value))} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--figma-border)', background: 'var(--figma-card)', color: '#fff' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="figma-btn-ghost" style={{ flex: 1 }} onClick={() => setEdit(null)}>Cancel</button>
            <button type="button" className="figma-btn-primary" style={{ flex: 1 }} onClick={() => apply(edit)}>Update</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SimpleScore({ scores, onScore, team1Name, team2Name }) {
  const s = scores && typeof scores.team1 === 'number' ? scores : { team1: 0, team2: 0 };
  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 24, padding: '24px 16px' }}>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{team1Name}</div>
        <div style={{ color: '#fff', fontSize: 48, fontWeight: 700, marginBottom: 12 }}>{s.team1}</div>
        <button type="button" className="figma-btn-primary" style={{ width: '100%' }} onClick={() => onScore('team1', 1)}>+1</button>
      </div>
      <span style={{ color: '#64748B', fontSize: 24, fontWeight: 600 }}>-</span>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>{team2Name}</div>
        <div style={{ color: '#fff', fontSize: 48, fontWeight: 700, marginBottom: 12 }}>{s.team2}</div>
        <button type="button" className="figma-btn-primary" style={{ width: '100%' }} onClick={() => onScore('team2', 1)}>+1</button>
      </div>
    </div>
  );
}

export function LiveMatchScreen({ match: propMatch, onBack, onStartMatch, onUpdateScore, onCompleteMatch }) {
  const { setHideBottomNav } = useNav();
  const [match, setMatch] = useState(() => ({ ...DEFAULT_MATCH, ...propMatch }));

  const sport = match.sport || 'Other';
  const scoreType = SPORT_SCORE_TYPE[sport] || 'simple';

  const getInitialScores = (st) => {
    if (st === 'cricket') return { innings1: { runs: 0, wickets: 0, overs: 0 }, innings2: { runs: 0, wickets: 0, overs: 0 } };
    if (st === 'tennis') return { sets: [], games: { team1: 0, team2: 0 }, points: { team1: 0, team2: 0 }, serving: 'team1' };
    if (st === 'badminton') return { sets: [], points: { team1: 0, team2: 0 }, serving: 'team1' };
    if (st === 'football') return { team1: 0, team2: 0, half: 1 };
    if (st === 'basketball') return { team1: 0, team2: 0, quarter: 1 };
    return { team1: 0, team2: 0 };
  };

  const isScoresValidForType = (sc, st) => {
    if (!sc || typeof sc !== 'object' || !Object.keys(sc).length) return false;
    if (st === 'tennis') return Array.isArray(sc.sets) && sc.games && sc.points;
    if (st === 'badminton') return Array.isArray(sc.sets) && sc.points;
    if (st === 'cricket') return sc.innings1 || sc.innings2;
    if (st === 'football' || st === 'basketball' || st === 'simple') return typeof sc.team1 === 'number';
    return typeof sc.team1 === 'number';
  };

  const [scores, setScores] = useState(() => {
    if (isScoresValidForType(match.scores, scoreType)) return match.scores;
    return getInitialScores(scoreType);
  });

  useEffect(() => {
    setHideBottomNav(true);
    return () => setHideBottomNav(false);
  }, [setHideBottomNav]);

  const handleScore = (key, value) => {
    let next;
    if (key === 'full') {
      next = value;
    } else if (key === 'team1' || key === 'team2') {
      next = { ...scores, [key]: (scores[key] || 0) + value };
    } else if (key === 'innings1' || key === 'innings2') {
      next = { ...scores, [key]: value };
    } else {
      next = { ...scores, ...value };
    }
    setScores(next);
    onUpdateScore && onUpdateScore(next);
  };

  const handleStart = () => {
    setMatch((m) => ({ ...m, status: 'in_progress' }));
    onStartMatch && onStartMatch();
  };

  const handleComplete = () => {
    onCompleteMatch && onCompleteMatch(scores);
    onBack();
  };

  const handleReset = () => {
    setScores(getInitialScores(scoreType));
  };

  const isLive = match.status === 'in_progress';
  const isScheduled = match.status === 'scheduled';
  const team1Name = match.team1?.name || 'Team A';
  const team2Name = match.team2?.name || 'Team B';

  const renderScoreBoard = () => {
    const props = { scores, onScore: handleScore, team1Name, team2Name };
    switch (scoreType) {
      case 'tennis': return <TennisScore {...props} />;
      case 'badminton': return <BadmintonScore {...props} />;
      case 'cricket': return <CricketScore scores={scores} onScore={(k, v) => handleScore(k, v)} />;
      case 'football': return <FootballScore {...props} />;
      case 'basketball': return <BasketballScore {...props} />;
      default: return <SimpleScore {...props} />;
    }
  };

  return (
    <div className="figma-page" style={{ paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0, flex: 1 }}>Live Score</span>
        {isLive && <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.2)', color: '#22C55E', fontSize: 12, fontWeight: 600 }}>LIVE</span>}
      </div>

      <div className="figma-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', fontSize: 12, fontWeight: 600 }}>{match.sport}</span>
          <span style={{ color: '#94A3B8', fontSize: 12 }}>{scoreType === 'simple' ? 'Points' : scoreType.charAt(0).toUpperCase() + scoreType.slice(1)} scoring</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{team1Name}</span>
          <span style={{ color: '#94A3B8', fontSize: 14 }}>vs</span>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{team2Name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>
          <MapPin size={12} /> {match.venue} &middot; {match.location}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 13 }}>
          <Calendar size={12} /> {match.date} &middot; {match.time}
        </div>
      </div>

      {isScheduled && (
        <div style={{ marginBottom: 24 }}>
          <button type="button" className="figma-btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={handleStart}>
            <Play size={20} /> Start Match
          </button>
        </div>
      )}

      {(isLive || !isScheduled) && (
        <>
          {renderScoreBoard()}
          <div style={{ padding: '0 16px', display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="figma-btn-ghost" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={handleReset}>
              <RotateCcw size={16} /> Reset
            </button>
            {isLive && (
              <button type="button" className="figma-btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={handleComplete}>
                <Square size={16} /> Complete Match
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
