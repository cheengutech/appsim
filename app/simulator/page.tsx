'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
  metrics: {
    satisfactionScore: number
    engagementRate: number
    viralActions: number
  }
}

type SimResult = {
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

type SavedPrompt = {
  id: string
  created_at: string
  name: string
  tags: string[]
  prompt_text: string
  last_sim_summary: SimResult['summary'] | null
}

const TURN_LABELS = [
  'Simulating Day 1 — first impressions...',
  'Simulating Day 7 — habits forming...',
  'Simulating Day 30 — retention shaking out...',
  'Simulating Day 90 — long term survivors...',
]

export default function SimulatorV2() {
  const [appDesc, setAppDesc] = useState('')
  const [motivation, setMotivation] = useState('social')
  const [demographic, setDemographic] = useState('mixed')
  const [friction, setFriction] = useState('low')
  const [agentCount, setAgentCount] = useState('500')
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SimResult | null>(null)
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null)

  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveTags, setSaveTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([])
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  const [filterTag, setFilterTag] = useState('')
  const [showLibrary, setShowLibrary] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => { fetchPrompts() }, [])

  async function fetchPrompts() {
    setLoadingPrompts(true)
    const { data, error } = await supabase.from('prompts').select('*').order('created_at', { ascending: false })
    if (!error && data) setSavedPrompts(data)
    setLoadingPrompts(false)
  }

  async function runSim() {
    if (!appDesc.trim()) { alert('Describe your app first.'); return }
    setLoading(true); setError(''); setResult(null); setCurrentStep(0)
    let step = 0
    const stepTimer = setInterval(() => { step++; if (step < 4) setCurrentStep(step) }, 8000)
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appDesc, motivation, demographic, friction, agentCount: parseInt(agentCount) })
      })
      clearInterval(stepTimer)
      if (!res.ok) { const t = await res.text(); throw new Error(`${res.status}: ${t}`) }
      const data: SimResult = await res.json()
      setResult(data); setCurrentStep(-1)
    } catch (e: any) {
      clearInterval(stepTimer); setError(e.message); setCurrentStep(-1)
    }
    setLoading(false)
  }

  async function savePrompt() {
    if (!saveName.trim()) { alert('Give this prompt a name.'); return }
    setSaving(true)
    const tags = saveTags.split(',').map(t => t.trim()).filter(Boolean)
    const { error } = await supabase.from('prompts').insert({
      name: saveName.trim(), tags,
      prompt_text: appDesc,
      last_sim_summary: result?.summary ?? null
    })
    if (!error) {
      setSaveSuccess(true); setShowSaveModal(false)
      setSaveName(''); setSaveTags('')
      fetchPrompts()
      setTimeout(() => setSaveSuccess(false), 3000)
    }
    setSaving(false)
  }

  async function deletePrompt(id: string) {
    await supabase.from('prompts').delete().eq('id', id)
    setDeleteConfirm(null); fetchPrompts()
  }

  function loadPrompt(p: SavedPrompt) {
    setAppDesc(p.prompt_text)
    setShowLibrary(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const allTags = Array.from(new Set(savedPrompts.flatMap(p => p.tags))).filter(Boolean)
  const filteredPrompts = filterTag ? savedPrompts.filter(p => p.tags.includes(filterTag)) : savedPrompts
  const s = result?.summary

  function mc(v: number, lo: number, hi: number) {
    return v >= hi ? '#1D9E75' : v >= lo ? '#BA7517' : '#A32D2D'
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: "'Georgia', serif", color: '#1a1a1a', background: '#fafaf8', minHeight: '100vh' }}>

      <div style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={SC}>Multi-turn simulation engine</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Georgia', serif", margin: '4px 0 0' }}>Agent Simulator v2</h1>
          <p style={{ fontSize: 13, color: '#666', margin: '6px 0 0', fontFamily: 'system-ui' }}>Agents carry history across 4 turns. Outcomes are causally connected.</p>
        </div>
        <button onClick={() => setShowLibrary(!showLibrary)} style={BtnO}>
          {showLibrary ? 'Hide library' : `Prompt library${savedPrompts.length > 0 ? ` (${savedPrompts.length})` : ''}`}
        </button>
      </div>

      {showLibrary && (
        <div style={{ background: '#fff', border: '1px solid #e8e8e4', marginBottom: 24, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={SC}>Saved prompts</div>
            {allTags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                <button onClick={() => setFilterTag('')} style={{ ...TBtn, background: !filterTag ? '#1a1a1a' : '#f0f0ec', color: !filterTag ? '#fff' : '#555' }}>all</button>
                {allTags.map(tag => (
                  <button key={tag} onClick={() => setFilterTag(tag === filterTag ? '' : tag)} style={{ ...TBtn, background: filterTag === tag ? '#1a1a1a' : '#f0f0ec', color: filterTag === tag ? '#fff' : '#555' }}>{tag}</button>
                ))}
              </div>
            )}
          </div>
          {loadingPrompts && <p style={MT}>Loading...</p>}
          {!loadingPrompts && filteredPrompts.length === 0 && <p style={MT}>No saved prompts yet. Run a simulation and save it.</p>}
          {filteredPrompts.map(p => (
            <div key={p.id} style={{ border: '1px solid #e8e8e4', marginBottom: 8, padding: '12px 14px', background: '#fafaf8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'system-ui', marginBottom: 4 }}>{p.name}</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' as const, marginBottom: 6, alignItems: 'center' }}>
                    {p.tags.map(tag => <span key={tag} style={TBadge}>{tag}</span>)}
                    <span style={{ fontSize: 11, color: '#aaa', fontFamily: 'system-ui' }}>
                      {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  {p.last_sim_summary && (
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const, marginBottom: 6 }}>
                      {[
                        { label: 'D7', val: `${p.last_sim_summary.day7Retention}%` },
                        { label: 'D30', val: `${p.last_sim_summary.day30Retention}%` },
                        { label: 'NPS', val: `${p.last_sim_summary.nps > 0 ? '+' : ''}${p.last_sim_summary.nps}` },
                        { label: 'Viral', val: p.last_sim_summary.viralCoefficient.toFixed(2) },
                      ].map(m => (
                        <span key={m.label} style={{ fontSize: 12, fontFamily: 'system-ui', color: '#555' }}>
                          <span style={{ color: '#aaa' }}>{m.label} </span>{m.val}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#888', fontFamily: 'system-ui', lineHeight: 1.5, maxHeight: 36, overflow: 'hidden' }}>
                    {p.prompt_text.slice(0, 120)}...
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => loadPrompt(p)} style={BtnS}>Load</button>
                  {deleteConfirm === p.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => deletePrompt(p.id)} style={{ ...BtnS, background: '#A32D2D', color: '#fff', border: 'none' }}>Confirm</button>
                      <button onClick={() => setDeleteConfirm(null)} style={BtnS}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(p.id)} style={{ ...BtnS, color: '#A32D2D', borderColor: '#A32D2D' }}>Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={LS}>App concept</div>
        <textarea rows={4} value={appDesc} onChange={e => setAppDesc(e.target.value)} placeholder="Describe your app..." style={IS as React.CSSProperties} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={LS}>Motivation</div>
          <select value={motivation} onChange={e => setMotivation(e.target.value)} style={IS as React.CSSProperties}>
            <option value="social">Social / community</option>
            <option value="self-improvement">Self-improvement</option>
            <option value="financial">Financial incentive</option>
            <option value="entertainment">Entertainment</option>
            <option value="health">Health & fitness</option>
          </select>
        </div>
        <div>
          <div style={LS}>Demographic</div>
          <select value={demographic} onChange={e => setDemographic(e.target.value)} style={IS as React.CSSProperties}>
            <option value="mixed">Mixed ages</option>
            <option value="gen-z">Gen Z (18–26)</option>
            <option value="millennials">Millennials (27–42)</option>
            <option value="professionals">Working professionals</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={LS}>Agent count</div>
          <select value={agentCount} onChange={e => setAgentCount(e.target.value)} style={IS as React.CSSProperties}>
            <option value="100">100 agents</option>
            <option value="500">500 agents</option>
            <option value="1000">1000 agents</option>
          </select>
        </div>
        <div>
          <div style={LS}>Onboarding friction</div>
          <select value={friction} onChange={e => setFriction(e.target.value)} style={IS as React.CSSProperties}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <button onClick={runSim} disabled={loading} style={{ width: '100%', padding: 13, fontSize: 14, fontWeight: 700, fontFamily: 'system-ui', letterSpacing: 1, textTransform: 'uppercase' as const, background: loading ? '#ccc' : '#1a1a1a', color: '#fafaf8', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 10 }}>
        {loading ? 'Simulation running...' : `Run ${agentCount}-agent simulation →`}
      </button>

      {loading && (
        <div style={{ marginBottom: 16 }}>
          {TURN_LABELS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #e8e8e4', opacity: i <= currentStep ? 1 : 0.3, transition: 'opacity 0.5s' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: i < currentStep ? '#1D9E75' : i === currentStep ? '#1a1a1a' : '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.3s' }}>
                {i < currentStep && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                {i === currentStep && <span style={{ color: '#fff', fontSize: 10 }}>●</span>}
              </div>
              <span style={{ fontSize: 13, fontFamily: 'system-ui', color: i === currentStep ? '#1a1a1a' : '#888' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {error && <div style={{ padding: '12px 14px', background: '#FCEBEB', border: '1px solid #F09595', fontSize: 13, fontFamily: 'system-ui', color: '#501313', marginBottom: 16 }}>{error}</div>}
      {saveSuccess && <div style={{ padding: '10px 14px', background: '#E1F5EE', border: '1px solid #9FE1CB', fontSize: 13, fontFamily: 'system-ui', color: '#085041', marginBottom: 16 }}>Prompt saved to library ✓</div>}

      {result && s && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowSaveModal(true)} style={BtnO}>Save prompt + results →</button>
          </div>

          <div style={SH}>Final results — 90 day simulation</div>
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

      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: 24, width: 420, maxWidth: '90vw' }}>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'system-ui', marginBottom: 16 }}>Save prompt to library</div>
            <div style={{ marginBottom: 12 }}>
              <div style={LS}>Name</div>
              <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="e.g. Missionville v3 — sponsor model" style={{ ...IS, resize: undefined } as React.CSSProperties} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={LS}>Tags (comma separated)</div>
              <input value={saveTags} onChange={e => setSaveTags(e.target.value)} placeholder="e.g. Missionville, sponsor model" style={{ ...IS, resize: undefined } as React.CSSProperties} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={savePrompt} disabled={saving} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 700, fontFamily: 'system-ui', background: '#1a1a1a', color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowSaveModal(false)} style={{ ...BtnO, flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const SC = { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#888', fontFamily: 'system-ui' }
const LS = { fontSize: 12, color: '#666', fontFamily: 'system-ui', marginBottom: 5, letterSpacing: 0.5 }
const IS = { width: '100%', fontSize: 14, fontFamily: 'system-ui', border: '1px solid #d0d0cc', padding: '9px 11px', background: '#fff', color: '#1a1a1a', resize: 'vertical', outline: 'none', boxSizing: 'border-box' as const }
const SH = { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' as const, color: '#888', fontFamily: 'system-ui', borderBottom: '2px solid #1a1a1a', paddingBottom: 6, marginBottom: 14 }
const ML = { fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' as const, color: '#888', fontFamily: 'system-ui', marginBottom: 6 }
const LI = { fontSize: 13, fontFamily: 'system-ui', color: '#444', marginBottom: 4, lineHeight: 1.5 }
const BtnO = { padding: '8px 14px', fontSize: 13, fontFamily: 'system-ui', background: 'transparent', border: '1px solid #1a1a1a', cursor: 'pointer', color: '#1a1a1a' }
const BtnS = { padding: '5px 10px', fontSize: 12, fontFamily: 'system-ui', background: 'transparent', border: '1px solid #ccc', cursor: 'pointer', color: '#444' }
const TBtn = { padding: '3px 8px', fontSize: 11, fontFamily: 'system-ui', border: 'none', cursor: 'pointer', borderRadius: 3 }
const TBadge = { fontSize: 11, padding: '2px 7px', background: '#f0f0ec', color: '#555', fontFamily: 'system-ui', borderRadius: 3 }
const MT = { fontSize: 13, color: '#888', fontFamily: 'system-ui' }