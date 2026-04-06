import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { toolName } = await req.json();
    if (!toolName) {
      return NextResponse.json({ error: "toolName is required" }, { status: 400 });
    }

    const prompt = `You are a product researcher. Use web search to find real discussions where people talk about how they use "${toolName}". Search broadly — Reddit, GitHub Discussions, Hacker News, X/Twitter, Discord communities, forums, and blog posts all count.

Search for these queries:
1. "${toolName} use case"
2. "${toolName} how I use it"
3. "${toolName} workflow"
4. "${toolName} reddit OR "hacker news" OR github"

After searching, analyze all results and return ONLY a JSON object (no markdown, no preamble) with this exact shape:

{
  "tool": "${toolName}",
  "totalPostsAnalyzed": <number>,
  "useCases": [
    {
      "category": "<short category name>",
      "description": "<1-2 sentence description of this use case>",
      "frequency": "high" | "medium" | "low",
      "exampleQuote": "<a paraphrased or short real quote from a user>",
      "sources": ["reddit", "github", "hackernews", "twitter", "forum", "blog"]
    }
  ],
  "topUserTypes": ["<type1>", "<type2>", "<type3>"],
  "sentiment": "positive" | "mixed" | "negative",
  "keyInsight": "<one sharp product insight from the community data>",
  "primaryCommunities": ["<where most discussion is happening, e.g. reddit, github, twitter>"]
}

Return 5-10 use cases ordered by frequency (high first). The "sources" field per use case should list where evidence for that use case was found. Return ONLY valid JSON, nothing else.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
        } as const,
      ],
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response from Claude" }, { status: 500 });
    }

    let parsed;
    try {
      const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: "Failed to parse Claude response", raw: textBlock.text }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}