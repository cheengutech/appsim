import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120

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

async function runSimulation(appDesc: string, agentCount: number, appLabel: string) {
  const turns = [
    { turn: 1, day: 1,  label: 'Day 1 — First impressions' },
    { turn: 2, day: 7,  label: 'Day 7 — Early habit forming' },
    { turn: 3, day: 30, label: 'Day 30 — Core retention' },
    { turn: 4, day: 90, label: 'Day 90 — Long term survivors' },
  ]

  const results: TurnResult[] = []

  for (const t of turns) {
    const historyContext = results.length > 0
      ? `Previous turns:\n${results.map(r =>
          `Day ${r.day}: ${r.alive} alive, ${r.churned} churned. Churn: ${r.churnReasons.join(', ')}. Satisfaction: ${r.metrics.satisfactionScore}/100.`
        ).join('\n')}`
      : 'First turn.'

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are running turn ${t.turn} of a multi-turn user simulation for App "${appLabel}".

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
  "metrics": {
    "satisfactionScore": <0-100>,
    "engagementRate": <0-100>,
    "viralActions": <number>
  }
}`
      }]
    })

    const raw = message.content.find(b => b.type === 'text')?.text ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`Turn ${t.turn} returned no JSON`)
    const data = JSON.parse(match[0])
    results.push({ turn: t.turn, day: t.day, label: t.label, ...data })
  }

  const d7 = results[1]
  const d30 = results[2]
  const final = results[3]
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

async function declareWinner(appA: string, appB: string, labelA: string, labelB: string, summaryA: any, summaryB: any) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Two apps were simulated against the same 1000 agents over 90 days. Declare a winner and explain why in 3-4 sentences. Be direct and honest.

App A - "${labelA}":
${appA.slice(0, 300)}
Results: D7 retention ${summaryA.day7Retention}%, D30 retention ${summaryA.day30Retention}%, NPS ${summaryA.nps}, Viral ${summaryA.viralCoefficient}

App B - "${labelB}":
${appB.slice(0, 300)}
Results: D7 retention ${summaryB.day7Retention}%, D30 retention ${summaryB.day30Retention}%, NPS ${summaryB.nps}, Viral ${summaryB.viralCoefficient}

Respond ONLY with JSON:
{
  "winner": "A" or "B" or "tie",
  "winnerLabel": "<label of winner>",
  "margin": "close" or "clear" or "decisive",
  "verdict": "<3-4 sentence explanation of why one won>",
  "aStrength": "<one sentence on App A's biggest strength>",
  "bStrength": "<one sentence on App B's biggest strength>",
  "recommendation": "<one sentence on what to do next>"
}`
    }]
  })

  const raw = message.content.find(b => b.type === 'text')?.text ?? ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in winner declaration')
  return JSON.parse(match[0])
}

export async function POST(req: NextRequest) {
  const { appA, appB, labelA, labelB, agentCount = 500, motivation, demographic, friction } = await req.json()
  if (!appA || !appB) return NextResponse.json({ error: 'Both app concepts required' }, { status: 400 })

  // Run sequentially
  const resultA = await runSimulation(appA, agentCount, labelA || 'App A')
  const resultB = await runSimulation(appB, agentCount, labelB || 'App B')
  const winner = await declareWinner(appA, appB, labelA || 'App A', labelB || 'App B', resultA.summary, resultB.summary)

  return NextResponse.json({
    labelA: labelA || 'App A',
    labelB: labelB || 'App B',
    resultA,
    resultB,
    winner
  })
}