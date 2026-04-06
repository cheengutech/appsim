import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { concept, buyer, motion, results } = await req.json();

    const highRisks = results.risks.filter((r: { sev: string }) => r.sev === "high").map((r: { title: string }) => r.title);
    const medRisks = results.risks.filter((r: { sev: string }) => r.sev === "med").map((r: { title: string }) => r.title);

    const prompt = `You are a B2B SaaS advisor. A founder just ran a simulation for their product and needs a strategic breakdown.

Product: ${concept || "B2B SaaS product (no description provided)"}
Buyer segment: ${buyer}
Sales motion: ${motion}

Simulation results:
- Cohort: ${results.cohort} companies, ${results.converted} converted (${Math.round(results.converted / results.cohort * 100)}% conversion)
- Final ARR: $${results.finalARR}K at month ${results.months}
- NRR: ${results.nrr}%
- LTV: $${Math.round(results.ltv / 1000)}K, ${results.payback}mo payback
- Company health: ${results.healthy} healthy, ${results.expanding} expanding, ${results.atrisk} at risk, ${results.churned} churned
- High risks: ${highRisks.length > 0 ? highRisks.join(", ") : "none"}
- Medium risks: ${medRisks.length > 0 ? medRisks.join(", ") : "none"}
- Revenue split: $${results.plgArr}K PLG / $${results.slgArr}K sales-led / $${results.expArr}K expansion

Give a sharp, direct strategic breakdown in 3 parts:
1. What the numbers are actually saying (2-3 sentences, be specific about the NRR and health split)
2. The #1 thing to fix first and exactly how (be concrete, not generic)
3. One non-obvious insight this founder is probably missing

Keep it tight — max 250 words total. No headers, no bullet points, just direct prose.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const analysis = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("B2B analyze error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}