import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronUp, Calendar, MapPin, Clock, Award } from 'lucide-react';

const MATCH_STATS = {
  you: [
    { category: 'Performance', stats: [['Score', '21'], ['Winners', '12'], ['Errors', '5'], ['Aces', '3'], ['Smashes', '8'], ['Net Points', '6']] },
    { category: 'Accuracy', stats: [['Serve %', '78%'], ['Smash %', '72%'], ['Rally Win', '62%']] },
  ],
  opponent: [
    { category: 'Performance', stats: [['Score', '15'], ['Winners', '8'], ['Errors', '9'], ['Aces', '1'], ['Smashes', '5'], ['Net Points', '4']] },
    { category: 'Accuracy', stats: [['Serve %', '65%'], ['Smash %', '58%'], ['Rally Win', '38%']] },
  ],
};

const TIMELINE = [
  { time: '0:00', event: 'Match Started', type: 'neutral' },
  { time: '2:14', event: 'Ace Served', type: 'positive' },
  { time: '5:30', event: 'Smash Winner', type: 'positive' },
  { time: '8:45', event: 'Opponent Break', type: 'negative' },
  { time: '11:20', event: 'Rally Win (18 shots)', type: 'positive' },
  { time: '14:05', event: 'Set 1 Won 21-15', type: 'highlight' },
  { time: '16:40', event: 'Double Fault', type: 'negative' },
  { time: '19:15', event: 'Back-to-back aces', type: 'positive' },
  { time: '22:30', event: 'Match Won', type: 'highlight' },
];

const HIGHLIGHTS = [
  { label: 'Longest Rally', value: '18 shots', color: '#3B82F6' },
  { label: 'Fastest Serve', value: '224 km/h', color: '#22C55E' },
  { label: 'Win Streak', value: '5 points', color: '#F59E0B' },
  { label: 'Smash Accuracy', value: '72%', color: '#8B5CF6' },
];

function ComparisonBar({ label, yourVal, oppVal, maxVal }) {
  const yNum = parseFloat(yourVal) || 0;
  const oNum = parseFloat(oppVal) || 0;
  const mx = maxVal || Math.max(yNum, oNum, 1);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#3B82F6', fontSize: 14, fontWeight: 600 }}>{yourVal}</span>
        <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 500 }}>{label}</span>
        <span style={{ color: '#EF4444', fontSize: 14, fontWeight: 600 }}>{oppVal}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, height: 6 }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: `${(yNum / mx) * 100}%`, height: '100%', background: '#3B82F6', borderRadius: '999px 0 0 999px', minWidth: 4 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ width: `${(oNum / mx) * 100}%`, height: '100%', background: '#EF4444', borderRadius: '0 999px 999px 0', minWidth: 4 }} />
        </div>
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

export function MatchAnalyticsScreen({ match, onBack }) {
  const [tab, setTab] = useState('overview');

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Match Detail</span>
      </div>

      <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(34,197,94,0.08) 100%)', border: '1px solid var(--figma-border)', borderRadius: 20, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: '#fff', fontSize: 20, fontWeight: 700 }}>
              Y
            </div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>You</div>
          </div>
          <div style={{ textAlign: 'center', padding: '0 12px' }}>
            <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{match?.score || '21-15'}</div>
            <span style={{ padding: '3px 10px', borderRadius: 999, background: match?.result === 'Win' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: match?.result === 'Win' ? '#22C55E' : '#EF4444', fontSize: 12, fontWeight: 600 }}>
              {match?.result || 'Win'}
            </span>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--figma-card)', border: '1px solid var(--figma-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: '#94A3B8', fontSize: 20, fontWeight: 700 }}>
              {(match?.opponent || 'R')[0]}
            </div>
            <div style={{ color: '#94A3B8', fontSize: 14, fontWeight: 600 }}>{match?.opponent || 'Opponent'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, color: '#64748B', fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {match?.date || 'Mar 8'}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> 45 min</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> Elite Arena</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['overview', 'comparison', 'timeline'].map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: tab === t ? '#3B82F6' : 'var(--figma-card)', color: '#fff', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {HIGHLIGHTS.map((h) => (
              <div key={h.label} className="figma-card" style={{ padding: 14, textAlign: 'center' }}>
                <div style={{ color: h.color, fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{h.value}</div>
                <div style={{ color: '#94A3B8', fontSize: 12 }}>{h.label}</div>
              </div>
            ))}
          </div>
          {MATCH_STATS.you.map((cat) => (
            <CollapsibleSection key={cat.category} title={`Your ${cat.category}`}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {cat.stats.map(([label, value]) => (
                  <div key={label} style={{ padding: '8px 0', borderBottom: '1px solid var(--figma-border)' }}>
                    <div style={{ color: '#94A3B8', fontSize: 12 }}>{label}</div>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{value}</div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          ))}
        </>
      )}

      {tab === 'comparison' && (
        <div className="figma-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: '#3B82F6', fontSize: 13, fontWeight: 600 }}>You</span>
            <span style={{ color: '#EF4444', fontSize: 13, fontWeight: 600 }}>{match?.opponent || 'Opponent'}</span>
          </div>
          <ComparisonBar label="Score" yourVal="21" oppVal="15" maxVal={25} />
          <ComparisonBar label="Winners" yourVal="12" oppVal="8" maxVal={15} />
          <ComparisonBar label="Errors" yourVal="5" oppVal="9" maxVal={12} />
          <ComparisonBar label="Aces" yourVal="3" oppVal="1" maxVal={5} />
          <ComparisonBar label="Smash %" yourVal="72" oppVal="58" maxVal={100} />
          <ComparisonBar label="Serve %" yourVal="78" oppVal="65" maxVal={100} />
          <ComparisonBar label="Rally Win" yourVal="62" oppVal="38" maxVal={100} />
        </div>
      )}

      {tab === 'timeline' && (
        <div className="figma-card" style={{ padding: 16 }}>
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            <div style={{ position: 'absolute', left: 6, top: 4, bottom: 4, width: 2, background: 'var(--figma-border)' }} />
            {TIMELINE.map((ev, i) => {
              const dotColor = ev.type === 'positive' ? '#22C55E' : ev.type === 'negative' ? '#EF4444' : ev.type === 'highlight' ? '#F59E0B' : '#64748B';
              return (
                <div key={i} style={{ position: 'relative', marginBottom: 16 }}>
                  <div style={{ position: 'absolute', left: -20, top: 4, width: 12, height: 12, borderRadius: '50%', background: dotColor, border: ev.type === 'highlight' ? '2px solid #fff' : 'none' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: '#fff', fontSize: 14, fontWeight: ev.type === 'highlight' ? 700 : 500 }}>{ev.event}</span>
                    </div>
                    <span style={{ color: '#64748B', fontSize: 12, flexShrink: 0 }}>{ev.time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(59,130,246,0.1) 100%)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16, padding: 16, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Award size={18} color="#22C55E" />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Match MVP Analysis</span>
        </div>
        <div style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.6 }}>
          Dominant performance with a 72% smash accuracy. Your serve game was key, winning 78% of first-serve points. The 18-shot rally win at 11:20 was the turning point of the match.
        </div>
      </div>
    </div>
  );
}
