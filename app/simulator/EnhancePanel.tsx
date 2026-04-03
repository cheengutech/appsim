// ── ENHANCE PANEL ──────────────────────────────────────────────────────────
// Add this component to your existing simulator page.tsx
// Place <EnhancePanel> right after <SimResults> in the single mode results section

'use client'
import { useState } from 'react'

type SimSummary = {
  startingAgents: number; day7Retention: number; day30Retention: number
  finalAlive: number; totalViralJoins: number; viralCoefficient: number
  nps: number; avgSatisfaction: number
}

type TurnResult = {
  turn: number; day: number; label: string; alive: number; churned: number
  newFromViral: number; churnReasons: string[]; retainedBehaviors: string[]
  powerUsers: string[]; quotes: string[]
  metrics: { satisfactionScore: number; engagementRate: number; viralActions: number }
}

type SimResult = {
  funnel: { day: number; label: string; alive: number; newFromViral: number; churned: number }[]
  turns: TurnResult[]
  summary: SimSummary
}

type IterationResult = {
  label: string
  prompt: string
  result: SimResult
  changes: string[]
}

type Persona = {
  name: string; archetype: string; age: string; occupation: string
  pctOfUsers: number; d30Retention: number; backstory: string
  motivation: string; churnTrigger: string; evangelistCondition: string
  typicalQuote: string; sentiment: 'positive' | 'neutral' | 'negative'
}

type RevenueModel = {
  month1Revenue: number; month3Revenue: number; month6Revenue: number; month12Revenue: number
  ltv: number; paybackPeriodDays: number; monthlyChurnRate: number
  revenueBreakdown: { source: string; amount: number; pct: number }[]
  keyAssumptions: string[]; risks: string[]; verdict: string
}

const MONO_TYPES = [
  { id: 'subscription', label: 'Subscription', fields: [{ key: 'price', label: 'Monthly price ($)', placeholder: '9.99' }, { key: 'conversionRate', label: 'Free → paid conversion (%)', placeholder: '5' }] },
  { id: 'transaction', label: 'Transaction fee', fields: [{ key: 'feePercent', label: 'Fee percentage (%)', placeholder: '15' }, { key: 'avgTransactionValue', label: 'Avg transaction value ($)', placeholder: '25' }] },
  { id: 'freemium', label: 'Freemium', fields: [{ key: 'paidTierPrice', label: 'Paid tier price ($/mo)', placeholder: '12' }, { key: 'upgradeRate', label: 'Upgrade rate (%)', placeholder: '8' }] },
  { id: 'ads', label: 'Ads', fields: [{ key: 'cpm', label: 'CPM ($)', placeholder: '2.50' }, { key: 'sessionsPerUserPerMonth', label: 'Sessions per user/month', placeholder: '12' }] },
]

function mc(v: number, lo: number, hi: number) {
  return v >= hi ? '#1D9E75' : v >= lo ? '#BA7517' : '#A32D2D'
}

const SH = { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#888', fontFamily: 'system-ui', borderBottom: '2px solid #1a1a1a', paddingBottom: 6, marginBottom: 14 }
const LS = { fontSize: 12, color: '#666', fontFamily: 'system-ui', marginBottom: 5 }
const IS = { width: '100%', fontSize: 14, fontFamily: 'system-ui', border: '1px solid #d0d0cc', padding: '9px 11px', background: '#fff', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' as const }
const LI = { fontSize: 13, fontFamily: 'system-ui', color: '#444', marginBottom: 4, lineHeight: 1.5 }
const ML = { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#888', fontFamily: 'system-ui', marginBottom: 6 }

export default function EnhancePanel({ appDesc, simResult }: { appDesc: string; simResult: SimResult }) {
  // Iteration
  const [iterating, setIterating] = useState(false)
  const [iterations, setIterations] = useState<IterationResult[] | null>(null)
  const [iterStep, setIterStep] = useState('')
  const [selectedIter, setSelectedIter] = useState(0)

  // Personas
  const [loadingPersonas, setLoadingPersonas] = useState(false)
  const [personas, setPersonas] = useState<Persona[] | null>(null)

  // Revenue
  const [monoType, setMonoType] = useState('subscription')
  const [monoFields, setMonoFields] = useState<Record<string, string>>({})
  const [loadingRevenue, setLoadingRevenue] = useState(false)
  const [revenue, setRevenue] = useState<RevenueModel | null>(null)

  const [error, setError] = useState('')

  async function runIteration() {
    setIterating(true); setError(''); setIterations(null)
    setIterStep('Running original simulation...')

    const steps = [
      'Running original simulation...',
      'Analyzing weaknesses → rewriting concept...',
      'Running iteration 1...',
      'Optimizing further...',
      'Running iteration 2...',
      'Comparing results...'
    ]
    let si = 0
    const ticker = setInterval(() => {
      si = Math.min(si + 1, steps.length - 1)
      setIterStep(steps[si])
    }, 15000)

    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'iterate', appDesc, agentCount: simResult.summary.startingAgents })
      })
      clearInterval(ticker)
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setIterations(data.iterations)
      setSelectedIter(2)
    } catch (e: any) {
      clearInterval(ticker); setError(e.message)
    }
    setIterating(false); setIterStep('')
  }

  async function loadPersonas() {
    setLoadingPersonas(true); setError(''); setPersonas(null)
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'personas', appDesc, simResult })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setPersonas(data.personas)
    } catch (e: any) { setError(e.message) }
    setLoadingPersonas(false)
  }

  async function modelRevenue() {
    setLoadingRevenue(true); setError(''); setRevenue(null)
    const selectedType = MONO_TYPES.find(m => m.id === monoType)
    const monetization = { type: monoType, ...monoFields }
    try {
      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revenue', appDesc, simResult, monetization })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setRevenue(data.revenue)
    } catch (e: any) { setError(e.message) }
    setLoadingRevenue(false)
  }

  const sentimentColor = (s: string) => s === 'positive' ? '#1D9E75' : s === 'negative' ? '#A32D2D' : '#BA7517'
  const sentimentBg = (s: string) => s === 'positive' ? '#E1F5EE' : s === 'negative' ? '#FCEBEB' : '#FAEEDA'

  return (
    <div style={{ marginTop: 32 }}>

      {error && <div style={{ padding: '10px 14px', background: '#FCEBEB', border: '1px solid #F09595', fontSize: 13, fontFamily: 'system-ui', color: '#501313', marginBottom: 16 }}>{error}</div>}

      {/* ── ITERATION MODE ── */}
      <div style={SH}>Iteration mode</div>
      <p style={{ fontSize: 13, fontFamily: 'system-ui', color: '#666', marginBottom: 14, lineHeight: 1.6 }}>
        Automatically analyze weaknesses, rewrite the concept, and resimulate twice. See how metrics improve with each iteration.
      </p>

      <button onClick={runIteration} disabled={iterating} style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, fontFamily: 'system-ui', background: iterating ? '#ccc' : '#1a1a1a', color: '#fff', border: 'none', cursor: iterating ? 'not-allowed' : 'pointer', marginBottom: 16 }}>
        {iterating ? iterStep || 'Running...' : 'Auto-iterate this concept →'}
      </button>

      {iterating && (
        <div style={{ background: '#f7f7f5', border: '1px solid #e8e8e4', padding: '12px 16px', marginBottom: 16, fontSize: 13, fontFamily: 'system-ui', color: '#666' }}>
          ⟳ {iterStep}
        </div>
      )}

      {iterations && (
        <div>
          {/* Tab selector */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid #e8e8e4' }}>
            {iterations.map((it, i) => (
              <button key={i} onClick={() => setSelectedIter(i)} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'system-ui', background: 'transparent', border: 'none', cursor: 'pointer', color: selectedIter === i ? '#1a1a1a' : '#888', fontWeight: selectedIter === i ? 700 : 400, borderBottom: selectedIter === i ? '2px solid #1a1a1a' : '2px solid transparent', marginBottom: -1 }}>
                {it.label}
              </button>
            ))}
          </div>

          {/* Metrics comparison bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
            {iterations.map((it, i) => (
              <div key={i} style={{ border: `1px solid ${selectedIter === i ? '#1a1a1a' : '#e8e8e4'}`, padding: '10px 12px', background: selectedIter === i ? '#fff' : '#fafaf8', cursor: 'pointer' }} onClick={() => setSelectedIter(i)}>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui', marginBottom: 6 }}>{it.label}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                  {[
                    { label: 'D30', val: `${it.result.summary.day30Retention}%`, color: mc(it.result.summary.day30Retention, 15, 30) },
                    { label: 'NPS', val: `${it.result.summary.nps > 0 ? '+' : ''}${it.result.summary.nps}`, color: mc(it.result.summary.nps, 0, 30) },
                  ].map(m => (
                    <div key={m.label}>
                      <span style={{ fontSize: 10, color: '#aaa', fontFamily: 'system-ui' }}>{m.label} </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: 'system-ui' }}>{m.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Selected iteration detail */}
          {iterations[selectedIter].changes.length > 0 && (
            <div style={{ background: '#E1F5EE', border: '1px solid #9FE1CB', padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#085041', fontFamily: 'system-ui', marginBottom: 8 }}>Changes made in this iteration</div>
              {iterations[selectedIter].changes.map((c, i) => (
                <div key={i} style={{ fontSize: 13, fontFamily: 'system-ui', color: '#085041', marginBottom: 4 }}>→ {c}</div>
              ))}
            </div>
          )}

          {/* Improved prompt */}
          <details style={{ marginBottom: 16 }}>
            <summary style={{ fontSize: 13, fontFamily: 'system-ui', color: '#666', cursor: 'pointer', padding: '8px 0' }}>View {iterations[selectedIter].label} prompt</summary>
            <div style={{ background: '#fff', border: '1px solid #e8e8e4', padding: '12px 14px', marginTop: 8, fontSize: 13, fontFamily: 'system-ui', color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>
              {iterations[selectedIter].prompt}
            </div>
          </details>

          {/* Full metrics for selected */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Day 7 retention', val: `${iterations[selectedIter].result.summary.day7Retention}%`, color: mc(iterations[selectedIter].result.summary.day7Retention, 20, 40) },
              { label: 'Day 30 retention', val: `${iterations[selectedIter].result.summary.day30Retention}%`, color: mc(iterations[selectedIter].result.summary.day30Retention, 15, 30) },
              { label: 'NPS', val: `${iterations[selectedIter].result.summary.nps > 0 ? '+' : ''}${iterations[selectedIter].result.summary.nps}`, color: mc(iterations[selectedIter].result.summary.nps, 0, 30) },
              { label: 'Viral coefficient', val: iterations[selectedIter].result.summary.viralCoefficient.toFixed(2), color: iterations[selectedIter].result.summary.viralCoefficient >= 1 ? '#1D9E75' : '#BA7517' },
            ].map((m, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e8e8e4', padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.color, fontFamily: 'system-ui' }}>{m.val}</div>
              </div>
            ))}
          </div>

          {/* Key quotes from selected iteration */}
          <div style={ML}>Agent voices — {iterations[selectedIter].label}</div>
          {iterations[selectedIter].result.turns.flatMap(t => t.quotes).slice(0, 4).map((q, i) => (
            <div key={i} style={{ background: '#fafaf8', borderLeft: '2px solid #ccc', padding: '8px 12px', fontSize: 13, fontStyle: 'italic', color: '#555', marginBottom: 6, fontFamily: 'system-ui' }}>"{q}"</div>
          ))}
        </div>
      )}

      {/* ── PERSONA DEEP DIVE ── */}
      <div style={{ ...SH, marginTop: 32 }}>Persona deep dive</div>
      <p style={{ fontSize: 13, fontFamily: 'system-ui', color: '#666', marginBottom: 14, lineHeight: 1.6 }}>
        Generate detailed profiles for each user archetype — backstory, motivations, churn triggers, and what would make them evangelize.
      </p>

      <button onClick={loadPersonas} disabled={loadingPersonas} style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, fontFamily: 'system-ui', background: loadingPersonas ? '#ccc' : '#1a1a1a', color: '#fff', border: 'none', cursor: loadingPersonas ? 'not-allowed' : 'pointer', marginBottom: 16 }}>
        {loadingPersonas ? 'Generating personas...' : 'Generate persona profiles →'}
      </button>

      {personas && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
          {personas.map((p, i) => (
            <div key={i} style={{ border: '1px solid #e8e8e4', background: '#fff', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'system-ui', marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#888', fontFamily: 'system-ui' }}>{p.archetype} · {p.age} · {p.occupation}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', background: sentimentBg(p.sentiment), color: sentimentColor(p.sentiment), fontFamily: 'system-ui', borderRadius: 3 }}>{p.sentiment}</span>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: 11, color: '#aaa', fontFamily: 'system-ui' }}>D30 retention</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: mc(p.d30Retention, 20, 40), fontFamily: 'system-ui' }}>{p.d30Retention}%</div>
                  </div>
                  <div style={{ textAlign: 'right' as const }}>
                    <div style={{ fontSize: 11, color: '#aaa', fontFamily: 'system-ui' }}>% of users</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'system-ui' }}>{p.pctOfUsers}%</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={ML}>Backstory</div>
                  <div style={{ fontSize: 13, fontFamily: 'system-ui', color: '#444', lineHeight: 1.6 }}>{p.backstory}</div>
                </div>
                <div>
                  <div style={ML}>Motivation</div>
                  <div style={{ fontSize: 13, fontFamily: 'system-ui', color: '#444', lineHeight: 1.6 }}>{p.motivation}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ background: '#FCEBEB', padding: '10px 12px', borderRadius: 4 }}>
                  <div style={{ fontSize: 11, color: '#A32D2D', fontFamily: 'system-ui', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' as const }}>Churn trigger</div>
                  <div style={{ fontSize: 13, fontFamily: 'system-ui', color: '#501313' }}>{p.churnTrigger}</div>
                </div>
                <div style={{ background: '#E1F5EE', padding: '10px 12px', borderRadius: 4 }}>
                  <div style={{ fontSize: 11, color: '#085041', fontFamily: 'system-ui', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase' as const }}>Evangelist condition</div>
                  <div style={{ fontSize: 13, fontFamily: 'system-ui', color: '#085041' }}>{p.evangelistCondition}</div>
                </div>
              </div>

              <div style={{ background: '#fafaf8', borderLeft: '2px solid #ccc', padding: '8px 12px', fontSize: 13, fontStyle: 'italic', color: '#555', fontFamily: 'system-ui' }}>
                "{p.typicalQuote}"
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── REVENUE MODELING ── */}
      <div style={{ ...SH, marginTop: 32 }}>Revenue modeling</div>
      <p style={{ fontSize: 13, fontFamily: 'system-ui', color: '#666', marginBottom: 14, lineHeight: 1.6 }}>
        Estimate monthly revenue, LTV, and payback period based on your retention curves and monetization model.
      </p>

      <div style={{ background: '#fff', border: '1px solid #e8e8e4', padding: 16, marginBottom: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={LS}>Monetization type</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {MONO_TYPES.map(m => (
              <button key={m.id} onClick={() => { setMonoType(m.id); setMonoFields({}) }} style={{ padding: '6px 14px', fontSize: 13, fontFamily: 'system-ui', background: monoType === m.id ? '#1a1a1a' : '#f0f0ec', color: monoType === m.id ? '#fff' : '#555', border: 'none', cursor: 'pointer', borderRadius: 3 }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          {MONO_TYPES.find(m => m.id === monoType)?.fields.map(f => (
            <div key={f.key}>
              <div style={LS}>{f.label}</div>
              <input
                value={monoFields[f.key] ?? ''}
                onChange={e => setMonoFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={IS as React.CSSProperties}
              />
            </div>
          ))}
        </div>

        <button onClick={modelRevenue} disabled={loadingRevenue} style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, fontFamily: 'system-ui', background: loadingRevenue ? '#ccc' : '#1a1a1a', color: '#fff', border: 'none', cursor: loadingRevenue ? 'not-allowed' : 'pointer' }}>
          {loadingRevenue ? 'Modeling revenue...' : 'Model revenue →'}
        </button>
      </div>

      {revenue && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Month 1', val: `$${revenue.month1Revenue.toLocaleString()}` },
              { label: 'Month 3', val: `$${revenue.month3Revenue.toLocaleString()}` },
              { label: 'Month 6', val: `$${revenue.month6Revenue.toLocaleString()}` },
              { label: 'Month 12', val: `$${revenue.month12Revenue.toLocaleString()}` },
            ].map((m, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e8e8e4', padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui', marginBottom: 4 }}>{m.label} revenue</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', fontFamily: 'system-ui' }}>{m.val}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Avg LTV', val: `$${revenue.ltv.toLocaleString()}` },
              { label: 'Payback period', val: `${revenue.paybackPeriodDays} days` },
              { label: 'Monthly churn', val: `${revenue.monthlyChurnRate}%` },
            ].map((m, i) => (
              <div key={i} style={{ background: '#f7f7f5', border: '1px solid #e8e8e4', padding: '12px 14px' }}>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'system-ui', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'system-ui' }}>{m.val}</div>
              </div>
            ))}
          </div>

          {revenue.revenueBreakdown.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={ML}>Revenue breakdown</div>
              {revenue.revenueBreakdown.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 140, fontSize: 13, fontFamily: 'system-ui', color: '#555', flexShrink: 0 }}>{r.source}</div>
                  <div style={{ flex: 1, background: '#eee', height: 18, overflow: 'hidden', borderRadius: 2 }}>
                    <div style={{ width: `${r.pct}%`, height: '100%', background: '#1a1a1a' }} />
                  </div>
                  <div style={{ fontSize: 13, fontFamily: 'system-ui', color: '#555', width: 80, textAlign: 'right' as const }}>${r.amount.toLocaleString()}/mo</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={ML}>Key assumptions</div>
              {revenue.keyAssumptions.map((a, i) => <div key={i} style={LI}>· {a}</div>)}
            </div>
            <div>
              <div style={ML}>Revenue risks</div>
              {revenue.risks.map((r, i) => <div key={i} style={{ ...LI, color: '#A32D2D' }}>↓ {r}</div>)}
            </div>
          </div>

          <div style={{ background: '#f7f7f5', border: '1px solid #e8e8e4', padding: '12px 14px', fontSize: 14, fontFamily: "'Georgia', serif", color: '#1a1a1a', lineHeight: 1.7 }}>
            {revenue.verdict}
          </div>
        </div>
      )}
    </div>
  )
}