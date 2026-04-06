"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type UseCase = {
  category: string;
  description: string;
  frequency: "high" | "medium" | "low";
  exampleQuote: string;
  subreddits: string[];
};

type ScraperResult = {
  tool: string;
  totalPostsAnalyzed: number;
  useCases: UseCase[];
  topUserTypes: string[];
  sentiment: "positive" | "mixed" | "negative";
  keyInsight: string;
};

const freqColor = {
  high: { bg: "#E1F5EE", text: "#085041", label: "High" },
  medium: { bg: "#FAEEDA", text: "#633806", label: "Medium" },
  low: { bg: "#F1EFE8", text: "#444441", label: "Low" },
};

const sentimentColor = {
  positive: { bg: "#E1F5EE", text: "#085041" },
  mixed: { bg: "#FAEEDA", text: "#633806" },
  negative: { bg: "#FCEBEB", text: "#791F1F" },
};

function buildSimPrompt(result: ScraperResult): string {
  const topCases = result.useCases
    .filter((uc) => uc.frequency === "high" || uc.frequency === "medium")
    .slice(0, 5);

  return `App concept: ${result.tool}

This simulation is grounded in real Reddit user behavior data across ${result.useCases.length} observed use cases.

Key insight from Reddit: ${result.keyInsight}

Top user types to simulate: ${result.topUserTypes.join(", ")}

Primary use cases (ordered by frequency):
${topCases.map((uc, i) => `${i + 1}. ${uc.category}: ${uc.description}`).join("\n")}

Reddit community sentiment: ${result.sentiment}

Simulation instructions: Model how users across these real-world use case categories adopt, engage with, and churn from ${result.tool}. Weight your agent personas toward the highest-frequency use cases. Use the actual user types listed above to ensure realistic persona distribution. Simulate realistic day 1, day 7, day 30, and day 90 retention curves based on what you know about how these real use case segments behave.`;
}

export default function ScraperPage() {
  const [toolName, setToolName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSearch() {
    if (!toolName.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolName: toolName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendToSimulator() {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    try {
      const promptText = buildSimPrompt(result);
      const { error: sbError } = await supabase.from("prompts").insert({
        name: `${result.tool} — Reddit use case sim`,
        tags: ["reddit-scraper", result.tool.toLowerCase().replace(/\s+/g, "-")],
        prompt_text: promptText,
        last_sim_summary: null,
      });
      if (sbError) throw new Error(sbError.message);
      setSaved(true);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "2rem 1.25rem", fontFamily: "var(--font-sans, sans-serif)" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6, color: "var(--color-text-primary, #111)" }}>
          Reddit use case scraper
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary, #666)", margin: 0 }}>
          Enter any tool, app, or SaaS — get back the top ways people are actually using it on Reddit.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: "2rem" }}>
        <input
          type="text"
          value={toolName}
          onChange={(e) => setToolName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="e.g. Notion, Zapier, Linear, Cursor..."
          style={{
            flex: 1,
            padding: "10px 14px",
            fontSize: 14,
            border: "0.5px solid var(--color-border-secondary, #ccc)",
            borderRadius: 8,
            outline: "none",
            background: "var(--color-background-primary, #fff)",
            color: "var(--color-text-primary, #111)",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !toolName.trim()}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 500,
            border: "0.5px solid var(--color-border-secondary, #ccc)",
            borderRadius: 8,
            background: loading ? "var(--color-background-secondary, #f5f5f5)" : "var(--color-text-primary, #111)",
            color: loading ? "var(--color-text-secondary, #666)" : "var(--color-background-primary, #fff)",
            cursor: loading ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Searching Reddit…" : "Search →"}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--color-text-secondary, #666)", fontSize: 14 }}>
          <div style={{ marginBottom: 12, fontSize: 24 }}>🔍</div>
          Scanning Reddit for how people use <strong>{toolName}</strong>…
          <br />
          <span style={{ fontSize: 12, opacity: 0.7 }}>This takes ~15–30 seconds</span>
        </div>
      )}

      {error && (
        <div style={{
          padding: "14px 16px",
          background: "#FCEBEB",
          color: "#791F1F",
          borderRadius: 8,
          fontSize: 14,
          border: "0.5px solid #F09595",
        }}>
          {error}
        </div>
      )}

      {result && (
        <div>
          {/* Summary row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
            <div style={{ background: "var(--color-background-secondary, #f9f9f9)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary, #888)", marginBottom: 4 }}>Tool analyzed</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{result.tool}</div>
            </div>
            <div style={{ background: "var(--color-background-secondary, #f9f9f9)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary, #888)", marginBottom: 4 }}>Use cases found</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{result.useCases?.length ?? 0}</div>
            </div>
            <div style={{ background: "var(--color-background-secondary, #f9f9f9)", borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary, #888)", marginBottom: 4 }}>Reddit sentiment</div>
              <span style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 20,
                background: sentimentColor[result.sentiment]?.bg ?? "#eee",
                color: sentimentColor[result.sentiment]?.text ?? "#333",
                fontWeight: 500,
                display: "inline-block",
                marginTop: 4,
              }}>
                {result.sentiment}
              </span>
            </div>
          </div>

          {/* Key insight */}
          {result.keyInsight && (
            <div style={{
              padding: "14px 16px",
              background: "#E6F1FB",
              borderRadius: 8,
              borderLeft: "3px solid #378ADD",
              marginBottom: "1.5rem",
              fontSize: 14,
              color: "#0C447C",
              lineHeight: 1.5,
            }}>
              <strong>Key insight:</strong> {result.keyInsight}
            </div>
          )}

          {/* Send to simulator CTA */}
          <div style={{
            padding: "16px 18px",
            background: saved ? "#E1F5EE" : "var(--color-background-primary, #fff)",
            border: `0.5px solid ${saved ? "#9FE1CB" : "var(--color-border-secondary, #ddd)"}`,
            borderRadius: 10,
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap" as const,
            transition: "background 0.2s",
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3, color: saved ? "#085041" : "var(--color-text-primary, #111)" }}>
                {saved ? "Saved to simulator prompt library" : "Run a simulation from this data"}
              </div>
              <div style={{ fontSize: 12, color: saved ? "#0F6E56" : "var(--color-text-secondary, #888)" }}>
                {saved
                  ? `Open the simulator and load "${result.tool} — Reddit use case sim" from the prompt library`
                  : "Builds a sim prompt grounded in real Reddit use cases and saves it to your library"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {saved && (
                <a
                  href="/simulator"
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 500,
                    border: "0.5px solid #0F6E56",
                    borderRadius: 7,
                    background: "#085041",
                    color: "#E1F5EE",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Open simulator →
                </a>
              )}
              {!saved && (
                <div>
                  <button
                    onClick={handleSendToSimulator}
                    disabled={saving}
                    style={{
                      padding: "8px 18px",
                      fontSize: 13,
                      fontWeight: 500,
                      border: "0.5px solid #378ADD",
                      borderRadius: 7,
                      background: saving ? "var(--color-background-secondary, #f5f5f5)" : "#E6F1FB",
                      color: saving ? "var(--color-text-secondary, #888)" : "#0C447C",
                      cursor: saving ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {saving ? "Saving…" : "Send to simulator →"}
                  </button>
                  {saveError && (
                    <div style={{ fontSize: 11, color: "#791F1F", marginTop: 4 }}>{saveError}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* User types */}
          {result.topUserTypes?.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--color-text-primary, #111)" }}>
                Top user types
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.topUserTypes.map((t, i) => (
                  <span key={i} style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: "var(--color-background-secondary, #f5f5f5)",
                    color: "var(--color-text-secondary, #666)",
                    border: "0.5px solid var(--color-border-tertiary, #ddd)",
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Use case cards */}
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: "var(--color-text-primary, #111)" }}>
            Use cases
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.useCases?.map((uc, i) => (
              <div key={i} style={{
                background: "var(--color-background-primary, #fff)",
                border: "0.5px solid var(--color-border-tertiary, #e5e5e5)",
                borderRadius: 10,
                padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary, #111)" }}>
                    {uc.category}
                  </span>
                  <span style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: freqColor[uc.frequency]?.bg ?? "#eee",
                    color: freqColor[uc.frequency]?.text ?? "#333",
                    fontWeight: 500,
                  }}>
                    {freqColor[uc.frequency]?.label ?? uc.frequency} frequency
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary, #666)", margin: "0 0 8px", lineHeight: 1.5 }}>
                  {uc.description}
                </p>
                {uc.exampleQuote && (
                  <div style={{
                    fontSize: 12,
                    color: "var(--color-text-tertiary, #999)",
                    fontStyle: "italic",
                    borderLeft: "2px solid var(--color-border-secondary, #ddd)",
                    paddingLeft: 10,
                    marginBottom: 8,
                    lineHeight: 1.5,
                  }}>
                    "{uc.exampleQuote}"
                  </div>
                )}
                {uc.subreddits?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {uc.subreddits.map((s, j) => (
                      <span key={j} style={{
                        fontSize: 11,
                        padding: "2px 7px",
                        borderRadius: 4,
                        background: "var(--color-background-secondary, #f5f5f5)",
                        color: "var(--color-text-secondary, #888)",
                      }}>
                        r/{s.replace(/^r\//, "")}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}