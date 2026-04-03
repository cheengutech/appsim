import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type TurnResult = {
  turn: number; day: number; label: string; alive: number; churned: number
  newFromViral: number; churnReasons: string[]; retainedBehaviors: string[]
  powerUsers: string[]; quotes: string[]
  metrics: { satisfactionScore: number; engagementRate: number; viralActions: number }
}

type SimSummary = {
  startingAgents: number; day7Retention: number; day30Retention: number
  finalAlive: number; totalViralJoins: number; viralCoefficient: number
  nps: number; avgSatisfaction: number
}

type SimResult = {
  funnel: { day: number; label: string; alive: number; newFromViral: number; churned: number }[]
  turns: TurnResult[]
  summary: SimSummary
}

async function runSimulation(appDesc: string, agentCount: number): Promise<SimResult> {
  const turns = [
    { turn: 1, day: 1,  label: 'Day 1 — First impressions' },
    { turn: 2, day: 7,  label: 'Day 7 — Early habit forming' },
    { turn: 3, day: 30, label: 'Day 30 — Core retention' },
    { turn: 4, day: 90, label: 'Day 90 — Long term survivors' },
  ]
  const results: TurnResult[] = []

  for (const t of turns) {
    const historyContext = results.length > 0
      ? `Previous turns:\n${results.map(r => `Day ${r.day}: ${r.alive} alive, ${r.churned} churned. Churn: ${r.churnReasons.join(', ')}. Satisfaction: ${r.metrics.satisfactionScore}/100.`).join('\n')}`
      : 'First turn.'

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: `You are running turn ${t.turn} of a multi-turn user simulation.

App: ${appDesc}
Current day: Day ${t.day} (${t.label})
Starting agents: ${agentCount}

${historyContext}

Simulate what happens at day ${t.day}. Outcomes must be causally connected to previous turns.

Respond ONLY with valid JSON:
{
  "alive": <number>,
  "churned": <number>,
  "newFromViral": <number>,
  "churnReasons": ["reason 1", "reason 2", "reason 3"],
  "retainedBehaviors": ["behavior 1", "behavior 2", "behavior 3"],
  "powerUsers": ["power user description"],
  "quotes": ["retained agent quote", "churned agent quote", "viral signup quote"],
  "metrics": { "satisfactionScore": <0-100>, "engagementRate": <0-100>, "viralActions": <number> }
}` }]
    })

    const raw = message.content.find(b => b.type === 'text')?.text ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`Turn ${t.turn} returned no JSON`)
    results.push({ turn: t.turn, day: t.day, label: t.label, ...JSON.parse(match[0]) })
  }

  const d7 = results[1], d30 = results[2], final = results[3]
  const totalViral = results.reduce((s, r) => s + r.newFromViral, 0)
  const avgSat = Math.round(results.reduce((s, r) => s + r.metrics.satisfactionScore, 0) / results.length)

  return {
    funnel: results.map(r => ({ day: r.day, label: r.label, alive: r.alive, newFromViral: r.newFromViral, churned: r.churned })),
    turns: results,
    summary: {
      startingAgents: agentCount,
      day7Retention: Math.round((d7.alive / agentCount) * 100),
      day30Retention: Math.round((d30.alive / agentCount) * 100),
      finalAlive: final.alive,
      totalViralJoins: totalViral,
      viralCoefficient: +(totalViral / agentCount).toFixed(2),
      nps: Math.round((avgSat - 50) * 2),
      avgSatisfaction: avgSat,
    }
  }
}

async function improvePrompt(appDesc: string, simResult: SimResult, iteration: number): Promise<{ improvedPrompt: string; changes: string[] }> {
  const s = simResult.summary
  const allChurnReasons = simResult.turns.flatMap(t => t.churnReasons)
  const allRetained = simResult.turns.flatMap(t => t.retainedBehaviors)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: `You are a product optimizer. Analyze this app simulation and rewrite the concept to improve retention and NPS.

Original app concept:
${appDesc}

Simulation results (iteration ${iteration}):
- Day 7 retention: ${s.day7Retention}%
- Day 30 retention: ${s.day30Retention}%
- NPS: ${s.nps}
- Viral coefficient: ${s.viralCoefficient}

Top churn reasons: ${allChurnReasons.slice(0, 6).join(', ')}
What retained users: ${allRetained.slice(0, 6).join(', ')}

Rewrite the app concept to directly address the churn reasons while preserving what's working. Make specific, targeted changes — not a complete redesign. Focus on the 2-3 biggest problems.

Respond ONLY with JSON:
{
  "improvedPrompt": "<full rewritten app concept>",
  "changes": ["change 1 and why", "change 2 and why", "change 3 and why"]
}` }]
  })

  const raw = message.content.find(b => b.type === 'text')?.text ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in improvement')
  return JSON.parse(match[0])
}

async function generatePersonas(appDesc: string, simResult: SimResult): Promise<any[]> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: `Based on this app simulation, generate 5 detailed user personas.

App: ${appDesc}

Simulation data:
${simResult.turns.map(t => `Day ${t.day}: ${t.alive} alive. Churn: ${t.churnReasons.join(', ')}. Retained: ${t.retainedBehaviors.join(', ')}`).join('\n')}

Respond ONLY with JSON array of 5 personas:
[{
  "name": "<persona name>",
  "archetype": "<2-3 word archetype>",
  "age": "<age range>",
  "occupation": "<job>",
  "pctOfUsers": <percentage>,
  "d30Retention": <percentage>,
  "backstory": "<2 sentence backstory explaining why they downloaded the app>",
  "motivation": "<what they want from the app>",
  "churnTrigger": "<the specific thing that will make them leave>",
  "evangelistCondition": "<what would make them recommend it to others>",
  "typicalQuote": "<realistic quote from this persona about the app>",
  "sentiment": "positive" | "neutral" | "negative"
}]` }]
  })

  const raw = message.content.find(b => b.type === 'text')?.text ?? ''
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in personas')
  return JSON.parse(match[0])
}

async function modelRevenue(appDesc: string, simResult: SimResult, monetization: any): Promise<any> {
  const s = simResult.summary
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: `Model the revenue for this app based on simulation results and monetization config.

App: ${appDesc}

Simulation results:
- Starting agents: ${s.startingAgents}
- Day 30 retention: ${s.day30Retention}%
- Day 90 retention: ${Math.round((s.finalAlive / s.startingAgents) * 100)}%
- NPS: ${s.nps}
- Viral coefficient: ${s.viralCoefficient}

Monetization config: ${JSON.stringify(monetization)}

Calculate realistic revenue projections. Assume the ${s.startingAgents} agents represent a real user cohort acquired in month 1.

Respond ONLY with JSON:
{
  "month1Revenue": <number>,
  "month3Revenue": <number>,
  "month6Revenue": <number>,
  "month12Revenue": <number>,
  "ltv": <average lifetime value per user>,
  "paybackPeriodDays": <days to recover CAC assuming $10 CAC>,
  "monthlyChurnRate": <percentage>,
  "revenueBreakdown": [
    { "source": "<revenue source>", "amount": <monthly amount>, "pct": <percentage of total> }
  ],
  "keyAssumptions": ["assumption 1", "assumption 2", "assumption 3"],
  "risks": ["revenue risk 1", "revenue risk 2"],
  "verdict": "<2 sentence honest assessment of the business model viability>"
}` }]
  })

  const raw = message.content.find(b => b.type === 'text')?.text ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in revenue model')
  return JSON.parse(match[0])
}

export async function POST(req: NextRequest) {
  const { action, appDesc, agentCount = 500, simResult, iteration, monetization } = await req.json()

  if (action === 'iterate') {
    // Run initial sim
    const initial = await runSimulation(appDesc, agentCount)
    
    // Iteration 1
    const improvement1 = await improvePrompt(appDesc, initial, 1)
    const iter1 = await runSimulation(improvement1.improvedPrompt, agentCount)
    
    // Iteration 2
    const improvement2 = await improvePrompt(improvement1.improvedPrompt, iter1, 2)
    const iter2 = await runSimulation(improvement2.improvedPrompt, agentCount)

    return NextResponse.json({
      iterations: [
        { label: 'Original', prompt: appDesc, result: initial, changes: [] },
        { label: 'Iteration 1', prompt: improvement1.improvedPrompt, result: iter1, changes: improvement1.changes },
        { label: 'Iteration 2', prompt: improvement2.improvedPrompt, result: iter2, changes: improvement2.changes },
      ]
    })
  }

  if (action === 'personas') {
    const personas = await generatePersonas(appDesc, simResult)
    return NextResponse.json({ personas })
  }

  if (action === 'revenue') {
    const revenue = await modelRevenue(appDesc, simResult, monetization)
    return NextResponse.json({ revenue })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}