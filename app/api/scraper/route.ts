import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { toolName } = await req.json();
    if (!toolName) {
      return NextResponse.json({ error: "toolName is required" }, { status: 400 });
    }

    const prompt = `You are a product researcher. Use web search to find Reddit posts, threads, and comments where people discuss how they use "${toolName}".

Search for:
1. "site:reddit.com ${toolName} how I use"
2. "site:reddit.com ${toolName} use case"
3. "site:reddit.com ${toolName} workflow"

After searching, analyze the results and return ONLY a JSON object (no markdown, no preamble) with this exact shape:

{
  "tool": "${toolName}",
  "totalPostsAnalyzed": <number>,
  "useCases": [
    {
      "category": "<short category name>",
      "description": "<1-2 sentence description of this use case>",
      "frequency": "high" | "medium" | "low",
      "exampleQuote": "<a paraphrased or short real quote from a Reddit user>",
      "subreddits": ["<subreddit1>", "<subreddit2>"]
    }
  ],
  "topUserTypes": ["<type1>", "<type2>", "<type3>"],
  "sentiment": "positive" | "mixed" | "negative",
  "keyInsight": "<one sharp product insight from the Reddit data>"
}

Return 5-10 use cases. Order by frequency (high first). Return ONLY valid JSON, nothing else.`;

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