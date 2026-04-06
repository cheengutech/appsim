'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type TurnResult = {
  turn: number
  day: number
  label: string
  alive: number
  churned: number
  newFromViral: number
  churnReasons: string[]
  retainedBehaviors: string[]
  powerUsers: string[]
  quotes: string[]
  metrics: { satisfactionScore: number; engagementRate: number; viralActions: number }
}

type ResearchResult = {
  subreddit: string
  topic: string
  postsAnalyzed: number
  appPrompt: string
  funnel: { day: number; label: string; alive: number; newFromViral: number; churned: number }[]
  turns: TurnResult[]
  summary: {
    startingAgents: number
    day7Retention: number
    day30Retention: number
    finalAlive: number
    totalViralJoins: number
    viralCoefficient: number
    nps: number
    avgSatisfaction: number
  }
}

const STEPS = [
  { label: 'Fetching Reddit posts...', icon: '🔍' },
  { label: 'Analyzing pain points...', icon: '🧠' },
  { label: 'Synthesizing app concept...', icon: '✍️' },
  { label: 'Simulating Day 1...', icon: '👤' },
  { label: 'Simulating Day 7...', icon: '📅' },
  { label: 'Simulating Day 30...', icon: '📈' },
  { label: 'Simulating Day 90...', icon: '🏁' },
]

const POPULAR_SUBS = [
  'selfimprovement', 'productivity', 'habits', 'Fitness',
  'relationship_advice', 'personalfinance', 'entrepreneur',
  'startups', 'dating', 'mentalhealth', 'loseit', 'NoFap'
]

export default function RedditResearch() {
  const router = useRouter()
  const [subreddit, setSubreddit] = useState('')
  const [topic, setTopic] = useState('')
  const [agentCount, setAgentCount] = useState('500')
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [copied, setCopied] = useState(false)

  async function runPipeline() {
    if (!subreddit.trim() || !topic.trim()) { alert('Enter a subreddit and topic first.'); return }
    setLoading(true); setError(''); setResult(null); setCurrentStep(0)
  
    let step = 0
    const ticker = setInterval(() => {
      step = Math.min(step + 1, STEPS.length - 1)
      setCurrentStep(step)
    }, 7000)
  
    try {
      const res = await fetch('/api/reddit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subreddit: subreddit.trim(),
          topic: topic.trim(),
          agentCount: parseInt(agentCount)
        })
      })
  
      clearInterval(ticker)
      if (!res.ok) { const t = await res.text(); throw new Error(`${res.status}: ${t}`) }
      const data: ResearchResult = await res.json()
      setResult(data)
      setCurrentStep(STEPS.length)
    } catch (e: any) {
      clearInterval(ticker)
      setError(e.message)
    }
    setLoading(false)
    setCurrentStep(-1)
  }

  function copyPrompt() {
    if (!result) return
    navigator.clipboard.writeText(result.appPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function mc(v: number, lo: number, hi: number) {
    return v >= hi ? '#1D9E75' : v >= lo ? '#BA7517' : '#A32D2D'
  }

  const s = result?.summary

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: "'Georgia', serif", color: '#1a1a1a', background: '#fafaf8', minHeight: '100vh' }}>

{/* Nav */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #1a1a1a', marginBottom: 24 }}>
  <div style={{ display: 'flex' }}>
    {[
      { label: 'Simulator', path: '/simulator' },
      { label: 'Reddit Research', path: '/reddit' },
      { label: 'Use Case Scraper', path: '/scraper' },
    ].map(tab => (
      <button key={tab.path} onClick={() => router.push(tab.path)} style={{ padding: '10px 20px', fontSize: 13, fontFamily: 'system-ui', background: 'transparent', border: 'none', cursor: 'pointer', color: tab.path === '/reddit' ? '#1a1a1a' : '#888', fontWeight: tab.path === '/reddit' ? 700 : 400, borderBottom: tab.path === '/reddit' ? '2px solid #1a1a1a' : '2px solid transparent', marginBottom: -2 }}>
        {tab.label}
      </button>
    ))}
  </div>
</div>


      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={SC}>Reddit → Simulator pipeline</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Georgia', serif", margin: '4px 0 6px' }}>Research & Validate</h1>
        <p style={{ fontSize: 13, color: '#666', fontFamily: 'system-ui', margin: 0 }}>
          Scrape real Reddit pain points → synthesize into an app concept → run a full 90-day simulation. One click.
        </p>
      </div>

      {/* Inputs */}
      <div style={{ background: '#fff', border: '1px solid #e8e8e4', padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={LS}>Subreddit</div>
            <input
              value={subreddit} onChange={e => setSubreddit(e.target.value.replace('r/', ''))}
              placeholder="selfimprovement"
              style={IS as React.CSSProperties}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 5, marginTop: 8 }}>
              {POPULAR_SUBS.map(s => (
                <button key={s} onClick={() => setSubreddit(s)} style={{ ...TB, background: subreddit === s ? '#1a1a1a' : '#f0f0ec', color: subreddit === s ? '#fff' : '#555' }}>
                  r/{s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={LS}>Topic to research</div>
            <input
              value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. accountability partner, habit tracking"
              style={IS as React.CSSProperties}
            />
            <div style={{ marginTop: 12 }}>
              <div style={LS}>Agent count</div>
              <select value={agentCount} onChange={e => setAgentCount(e.target.value)} style={IS as React.CSSProperties}>
                <option value="100">100 agents (fast)</option>
                <option value="500">500 agents</option>
                <option value="1000">1000 agents</option>
              </select>
            </div>
          </div>
        </div>

        <button onClick={runPipeline} disabled={loading} style={{ width: '100%', padding: 13, fontSize: 14, fontWeight: 700, fontFamily: 'system-ui', letterSpacing: 1, textTransform: 'uppercase' as const, background: loading ? '#ccc' : '#1a1a1a', color: '#fafaf8', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? 'Running pipeline...' : 'Scrape → Synthesize → Simulate →'}
        </button>
      </div>

      {/* Progress */}
      {loading && (
        <div style={{ background: '#fff', border: '1px solid #e8e8e4', padding: 16, marginBottom: 20 }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < STEPS.length - 1 ? '1px solid #f0f0ec' : 'none', opacity: i <= currentStep ? 1 : 0.3, transition: 'opacity 0.4s' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: i < currentStep ? '#1D9E75' : i === currentStep ? '#1a1a1a' : '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, transition: 'background 0.3s' }}>
                {i < currentStep ? <span style={{ color: '#fff', fontSize: 12 }}>✓</span> : <span>{step.icon}</span>}
              </div>
              <span style={{ fontSize: 13, fontFamily: 'system-ui', color: i === currentStep ? '#1a1a1a' : '#888' }}>{step.label}</span>
              {i === currentStep && <span style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui', marginLeft: 'auto' }}>running...</span>}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 14px', background: '#FCEBEB', border: '1px solid #F09595', fontSize: 13, fontFamily: 'system-ui', color: '#501313', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && s && (
        <div>
          <div style={{ background: '#E1F5EE', border: '1px solid #9FE1CB', padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontFamily: 'system-ui', color: '#085041' }}>
              Analyzed <b>{result.postsAnalyzed}</b> posts from <b>r/{result.subreddit}</b> about <b>"{result.topic}"</b>
            </div>
            <button onClick={() => setShowPrompt(!showPrompt)} style={{ fontSize: 12, fontFamily: 'system-ui', background: 'transparent', border: '1px solid #085041', color: '#085041', padding: '4px 10px', cursor: 'pointer' }}>
              {showPrompt ? 'Hide prompt' : 'View synthesized prompt'}
            </button>
          </div>

          {showPrompt && (
            <div style={{ background: '#fff', border: '1px solid #e8e8e4', padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={SC}>Synthesized app concept from Reddit</div>
                <button onClick={copyPrompt} style={{ fontSize: 12, fontFamily: 'system-ui', background: copied ? '#1D9E75' : 'transparent', color: copied ? '#fff' : '#1a1a1a', border: '1px solid', borderColor: copied ? '#1D9E75' : '#1a1a1a', padding: '4px 10px', cursor: 'pointer' }}>
                  {copied ? 'Copied!' : 'Copy prompt'}
                </button>
              </div>
              <div style={{ fontSize: 13, fontFamily: 'system-ui', color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>
                {result.appPrompt}
              </div>
            </div>
          )}

          <div style={SH}>Simulation results — 90 days</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Day 7 retention', val: `${s.day7Retention}%`, color: mc(s.day7Retention, 20, 40) },
              { label: 'Day 30 retention', val: `${s.day30Retention}%`, color: mc(s.day30Retention, 15, 30) },
              { label: 'NPS', val: `${s.nps > 0 ? '+' : ''}${s.nps}`, color: mc(s.nps, 0, 30) },
              { label: 'Viral coefficient', val: s.viralCoefficient.toFixed(2), color: s.viralCoefficient >= 1 ? '#1D9E75' : s.viralCoefficient >= 0.5 ? '#BA7517' : '#A32D2D' },
            ].map((m, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e8e8e4', padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.color, fontFamily: 'system-ui' }}>{m.val}</div>
              </div>
            ))}
          </div>

          <div style={SH}>Retention curve</div>
          <div style={{ marginBottom: 24 }}>
            {result.funnel.map((f, i) => {
              const pct = Math.round((f.alive / s.startingAgents) * 100)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 60, fontSize: 12, color: '#888', fontFamily: 'system-ui', flexShrink: 0 }}>{f.label.split('—')[0].trim()}</div>
                  <div style={{ flex: 1, background: '#eee', height: 22, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#1a1a1a', display: 'flex', alignItems: 'center', paddingLeft: 6 }}>
                      <span style={{ fontSize: 11, color: '#fff', fontFamily: 'system-ui' }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#888', fontFamily: 'system-ui', width: 130, flexShrink: 0 }}>
                    {f.alive.toLocaleString()} alive
                    {f.newFromViral > 0 && <span style={{ color: '#1D9E75' }}> +{f.newFromViral} viral</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={SH}>Turn-by-turn breakdown</div>
          {result.turns.map((t, i) => (
            <div key={i} style={{ border: '1px solid #e8e8e4', marginBottom: 10, background: '#fff' }}>
              <div onClick={() => setExpandedTurn(expandedTurn === i ? null : i)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'system-ui' }}>{t.label}</span>
                  <span style={{ fontSize: 12, color: '#888', fontFamily: 'system-ui', marginLeft: 12 }}>
                    {t.alive.toLocaleString()} alive · {t.churned} churned
                    {t.newFromViral > 0 && <span style={{ color: '#1D9E75' }}> · +{t.newFromViral} viral</span>}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontFamily: 'system-ui', color: '#888' }}>Satisfaction: <b style={{ color: '#1a1a1a' }}>{t.metrics.satisfactionScore}/100</b></span>
                  <span style={{ fontSize: 14, color: '#888' }}>{expandedTurn === i ? '▲' : '▼'}</span>
                </div>
              </div>
              {expandedTurn === i && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #e8e8e4' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
                    <div>
                      <div style={ML}>Churn reasons</div>
                      {t.churnReasons.map((r, j) => <div key={j} style={LI}><span style={{ color: '#A32D2D', marginRight: 6 }}>↓</span>{r}</div>)}
                    </div>
                    <div>
                      <div style={ML}>Retained behaviors</div>
                      {t.retainedBehaviors.map((r, j) => <div key={j} style={LI}><span style={{ color: '#1D9E75', marginRight: 6 }}>↑</span>{r}</div>)}
                    </div>
                  </div>
                  {t.powerUsers.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={ML}>Power users emerging</div>
                      {t.powerUsers.map((p, j) => <div key={j} style={{ ...LI, color: '#185FA5' }}>⭐ {p}</div>)}
                    </div>
                  )}
                  <div style={{ marginTop: 14 }}>
                    <div style={ML}>Agent voices</div>
                    {t.quotes.map((q, j) => (
                      <div key={j} style={{ background: '#fafaf8', borderLeft: '2px solid #ccc', padding: '8px 12px', fontSize: 13, fontStyle: 'italic', color: '#555', marginBottom: 6, fontFamily: 'system-ui' }}>"{q}"</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {s.totalViralJoins > 0 && (
            <div style={{ background: '#E1F5EE', border: '1px solid #9FE1CB', padding: '14px 16px', marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'system-ui', color: '#085041', marginBottom: 4 }}>Viral growth summary</div>
              <div style={{ fontSize: 13, fontFamily: 'system-ui', color: '#085041' }}>
                {s.totalViralJoins} new agents joined through referrals across 90 days. Viral coefficient: {s.viralCoefficient.toFixed(2)} — {s.viralCoefficient >= 1 ? 'app is growing on its own' : s.viralCoefficient >= 0.5 ? 'meaningful organic growth' : 'needs stronger referral mechanic'}.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const SC = { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#888', fontFamily: 'system-ui' }
const LS = { fontSize: 12, color: '#666', fontFamily: 'system-ui', marginBottom: 5 }
const IS = { width: '100%', fontSize: 14, fontFamily: 'system-ui', border: '1px solid #d0d0cc', padding: '9px 11px', background: '#fff', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' as const }
const SH = { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#888', fontFamily: 'system-ui', borderBottom: '2px solid #1a1a1a', paddingBottom: 6, marginBottom: 14 }
const ML = { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#888', fontFamily: 'system-ui', marginBottom: 6 }
const LI = { fontSize: 13, fontFamily: 'system-ui', color: '#444', marginBottom: 4, lineHeight: 1.5 }
const TB = { padding: '3px 7px', fontSize: 11, fontFamily: 'system-ui', border: 'none', cursor: 'pointer', borderRadius: 3 }