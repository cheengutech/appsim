import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

async function runTurn(
  turn: number,
  day: number,
  label: string,
  appDesc: string,
  agentCount: number,
  previousTurns: TurnResult[],
  motivation: string,
  demographic: string,
  friction: string
): Promise<TurnResult> {

  const historyContext = previousTurns.length > 0
    ? `Previous simulation turns:\n${previousTurns.map(t =>
        `Day ${t.day} (${t.label}): ${t.alive} agents alive, ${t.churned} churned. ` +
        `Churn reasons: ${t.churnReasons.join(', ')}. ` +
        `Retained behaviors: ${t.retainedBehaviors.join(', ')}. ` +
        `Satisfaction: ${t.metrics.satisfactionScore}/100. ` +
        `Viral actions: ${t.metrics.viralActions}.`
      ).join('\n')}`
    : 'This is the first turn. No prior history.'

  const prompt = `You are running turn ${turn} of a multi-turn user simulation. Agents who survived previous turns carry their history and experiences into this turn. New agents may have joined via viral referrals.

App concept: ${appDesc}
Motivation: ${motivation}  
Demographic: ${demographic}
Onboarding friction: ${friction}
Starting agents: ${agentCount}
Current day: Day ${day} (${label})

${historyContext}

Based on what happened in previous turns, simulate what happens to agents NOW at day ${day}. Agents who had bad experiences in earlier turns are more likely to churn now. Agents who had good experiences are more likely to become power users and refer others. The outcomes must be causally connected to the previous turns.

Respond ONLY with valid JSON, no markdown:

{
  "alive": <agents still active at this turn, must be <= previous turn's alive + newFromViral>,
  "churned": <agents who churned THIS turn>,
  "newFromViral": <new agents who joined via referral from retained agents>,
  "churnReasons": ["reason 1", "reason 2", "reason 3"],
  "retainedBehaviors": ["behavior 1", "behavior 2", "behavior 3"],
  "powerUsers": ["description of emerging power user archetype"],
  "quotes": [
    "quote from a retained agent about their experience so far",
    "quote from an agent who just churned explaining why",
    "quote from a new viral signup about why they joined"
  ],
  "metrics": {
    "satisfactionScore": <0-100, must be causally consistent with previous turns>,
    "engagementRate": <0-100 percentage of alive agents who were active this period>,
    "viralActions": <number of shares, referrals, or viral moments this turn>
  }
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  })

  const raw = message.content.find(b => b.type === 'text')?.text ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Turn ${turn} returned no JSON`)
  const data = JSON.parse(match[0])

  return { turn, day, label, ...data }
}

export async function POST(req: NextRequest) {
  const { appDesc, motivation, demographic, friction, agentCount } = await req.json()
  if (!appDesc) return NextResponse.json({ error: 'appDesc required' }, { status: 400 })

  const turns = [
    { turn: 1, day: 1,  label: 'Day 1 — First impressions' },
    { turn: 2, day: 7,  label: 'Day 7 — Early habit forming' },
    { turn: 3, day: 30, label: 'Day 30 — Core retention' },
    { turn: 4, day: 90, label: 'Day 90 — Long term survivors' },
  ]

  const results: TurnResult[] = []

  for (const t of turns) {
    const result = await runTurn(
      t.turn, t.day, t.label,
      appDesc, agentCount, results,
      motivation, demographic, friction
    )
    results.push(result)
  }

  // Compute final funnel
  const funnel = results.map(r => ({
    day: r.day,
    label: r.label,
    alive: r.alive,
    newFromViral: r.newFromViral,
    churned: r.churned,
  }))

  const finalTurn = results[results.length - 1]
  const d30 = results[2]
  const d7 = results[1]

  const retention30 = Math.round((d30.alive / agentCount) * 100)
  const retention7 = Math.round((d7.alive / agentCount) * 100)
  const totalViral = results.reduce((s, r) => s + r.newFromViral, 0)
  const viralCoeff = +(totalViral / agentCount).toFixed(2)
  const avgSatisfaction = Math.round(results.reduce((s, r) => s + r.metrics.satisfactionScore, 0) / results.length)
  const nps = Math.round((avgSatisfaction - 50) * 2)

  return NextResponse.json({
    funnel,
    turns: results,
    summary: {
      startingAgents: agentCount,
      day7Retention: retention7,
      day30Retention: retention30,
      finalAlive: finalTurn.alive,
      totalViralJoins: totalViral,
      viralCoefficient: viralCoeff,
      nps,
      avgSatisfaction,
    }
  })
}