import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Star, Zap, Lock } from 'lucide-react';

const SPORT_CONFIGS = {
  cricket: {
    kpis: [
      { key: 'matches', label: 'Matches', value: 28, trend: 'up', delta: '+4' },
      { key: 'winRate', label: 'Win Rate', value: '64%', trend: 'up', delta: '+5%' },
      { key: 'runs', label: 'Total Runs', value: 842, trend: 'up', delta: '+120' },
      { key: 'avg', label: 'Batting Avg', value: '42.1', trend: 'down', delta: '-2.3' },
      { key: 'wickets', label: 'Wickets', value: 18, trend: 'flat', delta: '' },
      { key: 'sr', label: 'Strike Rate', value: '128.4', trend: 'up', delta: '+8.2' },
    ],
    categories: [
      { title: 'Batting', stats: [['Innings', '26'], ['Runs', '842'], ['Highest Score', '98*'], ['Average', '42.1'], ['Strike Rate', '128.4'], ['50s / 100s', '6 / 0'], ['4s / 6s', '84 / 22'], ['Not Outs', '6']] },
      { title: 'Bowling', stats: [['Overs', '42'], ['Wickets', '18'], ['Best Figures', '4/22'], ['Economy', '6.8'], ['Average', '22.4'], ['Maidens', '3']] },
      { title: 'Fielding', stats: [['Catches', '12'], ['Run Outs', '4'], ['Stumpings', '0']] },
    ],
    performance: [65, 45, 80, 55, 70, 92, 48, 75, 60, 85, 70, 78],
    radar: [{ label: 'Batting', value: 82 }, { label: 'Bowling', value: 58 }, { label: 'Fielding', value: 70 }, { label: 'Fitness', value: 75 }, { label: 'Game Sense', value: 68 }],
    winLoss: { wins: 18, losses: 8, draws: 2 },
  },
  badminton: {
    kpis: [
      { key: 'matches', label: 'Matches', value: 35, trend: 'up', delta: '+6' },
      { key: 'winRate', label: 'Win Rate', value: '71%', trend: 'up', delta: '+3%' },
      { key: 'smash', label: 'Smash %', value: '68%', trend: 'up', delta: '+5%' },
      { key: 'aces', label: 'Aces', value: 42, trend: 'up', delta: '+8' },
      { key: 'rallies', label: 'Avg Rally', value: '8.2', trend: 'flat', delta: '' },
      { key: 'errors', label: 'Unforced Err', value: '12%', trend: 'down', delta: '-2%' },
    ],
    categories: [
      { title: 'Offense', stats: [['Smash Winners', '124'], ['Smash %', '68%'], ['Net Kills', '86'], ['Drop Shots', '54'], ['Aces', '42']] },
      { title: 'Defense', stats: [['Blocks', '98'], ['Clears', '210'], ['Lifts', '156'], ['Rally Wins', '64%']] },
      { title: 'Serve', stats: [['Serve Win %', '72%'], ['Aces', '42'], ['Faults', '18'], ['Avg Speed', '220 km/h']] },
    ],
    performance: [70, 60, 85, 75, 90, 65, 80, 95, 70, 85, 75, 88],
    radar: [{ label: 'Power', value: 78 }, { label: 'Speed', value: 85 }, { label: 'Accuracy', value: 72 }, { label: 'Defense', value: 68 }, { label: 'Stamina', value: 80 }],
    winLoss: { wins: 25, losses: 10, draws: 0 },
  },
  tennis: {
    kpis: [
      { key: 'matches', label: 'Matches', value: 18, trend: 'up', delta: '+3' },
      { key: 'winRate', label: 'Win Rate', value: '61%', trend: 'down', delta: '-4%' },
      { key: 'aces', label: 'Aces/Match', value: '4.2', trend: 'up', delta: '+0.8' },
      { key: 'firstServe', label: '1st Serve %', value: '62%', trend: 'up', delta: '+3%' },
      { key: 'breakPts', label: 'Break Pts Won', value: '45%', trend: 'flat', delta: '' },
      { key: 'doubleFault', label: 'Double Faults', value: '2.1', trend: 'down', delta: '-0.4' },
    ],
    categories: [
      { title: 'Serving', stats: [['Aces', '76'], ['Double Faults', '38'], ['1st Serve %', '62%'], ['1st Serve Win %', '74%'], ['2nd Serve Win %', '51%'], ['Avg Serve Speed', '185 km/h']] },
      { title: 'Return', stats: [['Return Win %', '38%'], ['Break Points Won', '45%'], ['Return Aces', '12']] },
      { title: 'Points', stats: [['Winners', '342'], ['Unforced Errors', '218'], ['Net Points Won', '68%'], ['Tiebreaks Won', '4/7']] },
    ],
    performance: [50, 70, 60, 80, 55, 65, 75, 60, 70, 85, 55, 72],
    radar: [{ label: 'Serve', value: 75 }, { label: 'Return', value: 62 }, { label: 'Net Play', value: 70 }, { label: 'Endurance', value: 68 }, { label: 'Mental', value: 72 }],
    winLoss: { wins: 11, losses: 7, draws: 0 },
  },
  football: {
    kpis: [
      { key: 'matches', label: 'Matches', value: 22, trend: 'up', delta: '+5' },
      { key: 'winRate', label: 'Win Rate', value: '59%', trend: 'up', delta: '+8%' },
      { key: 'goals', label: 'Goals', value: 14, trend: 'up', delta: '+4' },
      { key: 'assists', label: 'Assists', value: 8, trend: 'up', delta: '+2' },
      { key: 'passAcc', label: 'Pass Acc', value: '82%', trend: 'flat', delta: '' },
      { key: 'tackles', label: 'Tackles', value: 34, trend: 'up', delta: '+6' },
    ],
    categories: [
      { title: 'Scoring', stats: [['Goals', '14'], ['Assists', '8'], ['Shots', '48'], ['Shots on Target', '28'], ['Conversion Rate', '29%'], ['Headers', '3']] },
      { title: 'Passing', stats: [['Pass Accuracy', '82%'], ['Key Passes', '22'], ['Crosses', '16'], ['Through Balls', '8']] },
      { title: 'Defense', stats: [['Tackles Won', '34'], ['Interceptions', '18'], ['Clearances', '12'], ['Blocks', '8']] },
    ],
    performance: [60, 55, 75, 80, 65, 70, 85, 60, 90, 70, 75, 80],
    radar: [{ label: 'Shooting', value: 72 }, { label: 'Passing', value: 80 }, { label: 'Dribbling', value: 65 }, { label: 'Defense', value: 60 }, { label: 'Pace', value: 78 }],
    winLoss: { wins: 13, losses: 6, draws: 3 },
  },
};

const DEFAULT_CONFIG = {
  kpis: [
    { key: 'matches', label: 'Matches', value: 10, trend: 'up', delta: '+2' },
    { key: 'winRate', label: 'Win Rate', value: '60%', trend: 'flat', delta: '' },
    { key: 'points', label: 'Total Points', value: 120, trend: 'up', delta: '+15' },
  ],
  categories: [{ title: 'General', stats: [['Matches Played', '10'], ['Wins', '6'], ['Losses', '4'], ['Win Rate', '60%']] }],
  performance: [60, 70, 55, 80, 65, 75, 70, 85, 60, 72],
  radar: [{ label: 'Offense', value: 70 }, { label: 'Defense', value: 65 }, { label: 'Fitness', value: 72 }, { label: 'Skill', value: 68 }],
  winLoss: { wins: 6, losses: 4, draws: 0 },
};

const RECENT_MATCHES = [
  { id: 1, opponent: 'Rahul M.', result: 'Win', date: 'Mar 8', keyStat: 'Top performer', score: '3-1' },
  { id: 2, opponent: 'Team Phoenix', result: 'Loss', date: 'Mar 5', keyStat: '2 goals scored', score: '2-4' },
  { id: 3, opponent: 'Priya V.', result: 'Win', date: 'Mar 1', keyStat: 'Season best', score: '21-15' },
  { id: 4, opponent: 'Club XI', result: 'Win', date: 'Feb 26', keyStat: '58 runs', score: '156/4' },
  { id: 5, opponent: 'Elite Squad', result: 'Loss', date: 'Feb 22', keyStat: 'Close match', score: '19-21' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIME_TABS = ['Career', 'Last 10', 'This Year'];

function KpiCard({ kpi, color }) {
  const TrendIcon = kpi.trend === 'up' ? TrendingUp : kpi.trend === 'down' ? TrendingDown : Minus;
  const trendColor = kpi.trend === 'up' ? '#22C55E' : kpi.trend === 'down' ? '#EF4444' : '#64748B';
  return (
    <div style={{ minWidth: 140, padding: 16, background: 'var(--figma-card)', border: '1px solid var(--figma-border)', borderRadius: 16, flexShrink: 0 }}>
      <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>{kpi.label}</div>
      <div style={{ color: '#fff', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>{kpi.value}</div>
      {kpi.delta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <TrendIcon size={14} color={trendColor} />
          <span style={{ color: trendColor, fontSize: 12, fontWeight: 600 }}>{kpi.delta}</span>
        </div>
      )}
    </div>
  );
}

function MiniBarChart({ data, color }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: '100%', height: `${(v / max) * 100}%`, minHeight: 4, background: `linear-gradient(180deg, ${color} 0%, ${color}80 100%)`, borderRadius: '4px 4px 0 0' }} />
          <span style={{ color: '#64748B', fontSize: 9 }}>{MONTHS[i] || ''}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ wins, losses, draws }) {
  const total = wins + losses + draws || 1;
  const wPct = (wins / total) * 100;
  const lPct = (losses / total) * 100;
  const dPct = (draws / total) * 100;
  const wEnd = wPct * 3.6;
  const lEnd = wEnd + lPct * 3.6;
  const gradient = `conic-gradient(#22C55E 0deg ${wEnd}deg, #EF4444 ${wEnd}deg ${lEnd}deg, #64748B ${lEnd}deg 360deg)`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ width: 100, height: 100, borderRadius: '50%', background: gradient, position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', background: 'var(--figma-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{total}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: '#22C55E' }} />
          <span style={{ color: '#94A3B8', fontSize: 13 }}>Wins {wins} ({Math.round(wPct)}%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: '#EF4444' }} />
          <span style={{ color: '#94A3B8', fontSize: 13 }}>Losses {losses} ({Math.round(lPct)}%)</span>
        </div>
        {draws > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: '#64748B' }} />
            <span style={{ color: '#94A3B8', fontSize: 13 }}>Draws {draws} ({Math.round(dPct)}%)</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RadarChart({ data, color }) {
  const cx = 90, cy = 90, r = 70;
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;
  const points = data.map((d, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const pct = d.value / 100;
    return { x: cx + r * pct * Math.cos(angle), y: cy + r * pct * Math.sin(angle), label: d.label, value: d.value };
  });
  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');
  const gridLevels = [0.25, 0.5, 0.75, 1];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={180} height={180} viewBox="0 0 180 180">
        {gridLevels.map((lvl) => (
          <polygon key={lvl} points={Array.from({ length: n }, (_, i) => {
            const a = i * angleStep - Math.PI / 2;
            return `${cx + r * lvl * Math.cos(a)},${cy + r * lvl * Math.sin(a)}`;
          }).join(' ')} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        ))}
        {data.map((_, i) => {
          const a = i * angleStep - Math.PI / 2;
          return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(a)} y2={cy + r * Math.sin(a)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
        })}
        <polygon points={polygon} fill={`${color}30`} stroke={color} strokeWidth="2" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />)}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
        {data.map((d) => (
          <span key={d.label} style={{ color: '#94A3B8', fontSize: 11, background: 'rgba(255,255,255,0.04)', padding: '3px 8px', borderRadius: 6 }}>
            {d.label}: <span style={{ color: '#fff', fontWeight: 600 }}>{d.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CollapsibleSection({ title, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="figma-card" style={{ marginBottom: 12, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, fontWeight: 600 }}>
        {title}
        {open ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

export function SportDashboard({ sport, onBack, onViewMatch }) {
  const [timeTab, setTimeTab] = useState('Career');
  const sportId = (sport?.id || sport?.name || '').toLowerCase().replace(/\s+/g, '-');
  const config = SPORT_CONFIGS[sportId] || DEFAULT_CONFIG;
  const color = sport?.color || '#3B82F6';

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{sport?.icon || '🏅'}</span>
            <span className="figma-heading2" style={{ margin: 0 }}>{sport?.name || 'Sport'} Analytics</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TIME_TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTimeTab(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: timeTab === t ? color : 'var(--figma-card)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8, marginBottom: 20 }}>
        {config.kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} color={color} />)}
      </div>

      <CollapsibleSection title="Performance Over Time">
        <MiniBarChart data={config.performance} color={color} />
      </CollapsibleSection>

      <CollapsibleSection title="Win/Loss Distribution">
        <DonutChart {...config.winLoss} />
      </CollapsibleSection>

      <CollapsibleSection title="Skill Profile">
        <RadarChart data={config.radar} color={color} />
      </CollapsibleSection>

      {config.categories.map((cat) => (
        <CollapsibleSection key={cat.title} title={cat.title} defaultOpen={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {cat.stats.map(([label, value], i) => (
              <div key={label} style={{ padding: '10px 0', borderBottom: i < cat.stats.length - 2 ? '1px solid var(--figma-border)' : 'none', gridColumn: i === cat.stats.length - 1 && cat.stats.length % 2 !== 0 ? '1 / -1' : undefined }}>
                <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 2 }}>{label}</div>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      ))}

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Recent Matches</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {RECENT_MATCHES.slice(0, 4).map((m) => (
            <div key={m.id} className="figma-card" style={{ padding: 14, cursor: 'pointer' }} onClick={() => onViewMatch && onViewMatch(m)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>vs {m.opponent}</span>
                <span style={{ padding: '3px 10px', borderRadius: 999, background: m.result === 'Win' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: m.result === 'Win' ? '#22C55E' : '#EF4444', fontSize: 12, fontWeight: 600 }}>{m.result}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748B', fontSize: 12 }}>
                <span>{m.date} &bull; {m.keyStat}</span>
                <span style={{ color: '#94A3B8', fontWeight: 500 }}>{m.score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.12) 100%)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#fff" />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>AI Performance Insights</div>
            <div style={{ color: '#94A3B8', fontSize: 12 }}>Powered by Sportza AI</div>
          </div>
          <div style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 999, background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: '#fff', fontSize: 10, fontWeight: 700 }}>PRO</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Star size={14} color="#F59E0B" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ color: '#22C55E', fontWeight: 600 }}>Strength:</span> Consistent performance under pressure. Your win rate in close matches is 72%.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <TrendingUp size={14} color="#22C55E" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ color: '#3B82F6', fontWeight: 600 }}>Trend:</span> Your win rate improved 12% this month compared to last.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <TrendingDown size={14} color="#EF4444" style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.5 }}>
              <span style={{ color: '#F59E0B', fontWeight: 600 }}>Improve:</span> Focus on defensive play. Your loss rate increases 40% when opponent leads early.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#94A3B8', fontSize: 11 }}>Overall Skill Rating</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>7.8 <span style={{ fontSize: 14, color: '#94A3B8' }}>/ 10</span></div>
          </div>
          <button type="button" style={{ padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', color: '#fff', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lock size={14} /> Unlock Full Report
          </button>
        </div>
      </div>
    </div>
  );
}
