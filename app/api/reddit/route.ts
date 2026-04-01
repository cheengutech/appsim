import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
export const maxDuration = 60
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function fetchRedditPosts(subreddit: string, topic: string) {
  const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
  
  // Fetch top posts from the subreddit
  const topRes = await fetch(
    `https://www.reddit.com/r/${subreddit}/top.json?limit=25&t=month`,
    { headers }
  )
  const topData = await topRes.json()
  const topPosts = topData?.data?.children?.map((p: any) => ({
    title: p.data.title,
    selftext: p.data.selftext?.slice(0, 500),
    score: p.data.score,
    num_comments: p.data.num_comments,
    url: p.data.url
  })) ?? []

  // Search for topic-specific posts
  const searchRes = await fetch(
    `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(topic)}&sort=top&limit=25&t=year`,
    { headers }
  )
  const searchData = await searchRes.json()
  const searchPosts = searchData?.data?.children?.map((p: any) => ({
    title: p.data.title,
    selftext: p.data.selftext?.slice(0, 500),
    score: p.data.score,
    num_comments: p.data.num_comments,
  })) ?? []

  return { topPosts, searchPosts }
}

async function synthesizeToPrompt(subreddit: string, topic: string, posts: any) {
  const postsText = [
    ...posts.topPosts.map((p: any) => `[TOP] ${p.title}: ${p.selftext}`),
    ...posts.searchPosts.map((p: any) => `[SEARCH] ${p.title}: ${p.selftext}`)
  ].join('\n\n').slice(0, 8000).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF]/g, '')
  const synthesis = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `You are a product researcher analyzing Reddit posts to identify real user pain points and desires.

Subreddit: r/${subreddit}
Topic: ${topic}

Reddit posts:
${postsText}

Analyze these posts and synthesize them into a structured app concept prompt ready for user simulation testing.

The prompt should:
1. Be based ONLY on real pain points and desires expressed in the posts
2. Describe an app that directly addresses what these users are asking for
3. Include specific features users mentioned wanting
4. Note frustrations with existing solutions
5. Be written as a clear app concept description (2-4 paragraphs)

Return ONLY the app concept prompt text, no preamble or explanation.`
    }]
  })

  return synthesis.content.find(b => b.type === 'text')?.text ?? ''
}

async function runSimulation(appDesc: string, agentCount: number) {
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
        content: `You are running turn ${t.turn} of a multi-turn user simulation.

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

export async function POST(req: NextRequest) {
  const { subreddit, topic, agentCount = 500 } = await req.json()
  if (!subreddit || !topic) return NextResponse.json({ error: 'subreddit and topic required' }, { status: 400 })

  // Step 1: Fetch Reddit posts
  const posts = await fetchRedditPosts(subreddit, topic)

  // Step 2: Synthesize into app prompt
  const appPrompt = await synthesizeToPrompt(subreddit, topic, posts)

  // Step 3: Run simulation
  const simResult = await runSimulation(appPrompt, agentCount)

  return NextResponse.json({
    subreddit,
    topic,
    postsAnalyzed: posts.topPosts.length + posts.searchPosts.length,
    appPrompt,
    ...simResult
  })
}