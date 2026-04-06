"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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
  sources: string[];
};

type ScraperResult = {
  tool: string;
  totalPostsAnalyzed: number;
  useCases: UseCase[];
  topUserTypes: string[];
  sentiment: "positive" | "mixed" | "negative";
  keyInsight: string;
  primaryCommunities: string[];
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

const sourceLabel: Record<string, string> = {
  reddit: "Reddit",
  github: "GitHub",
  hackernews: "Hacker News",
  twitter: "X / Twitter",
  forum: "Forum",
  blog: "Blog",
};

function buildSimPrompt(result: ScraperResult): string {
  const topCases = result.useCases
    .filter((uc) => uc.frequency === "high" || uc.frequency === "medium")
    .slice(0, 5);

  return `App concept: ${result.tool}

This simulation is grounded in real community discussion data across ${result.useCases.length} observed use cases.

Key insight from community research: ${result.keyInsight}

Top user types to simulate: ${result.topUserTypes.join(", ")}

Primary use cases (ordered by frequency):
${topCases.map((uc, i) => `${i + 1}. ${uc.category}: ${uc.description}`).join("\n")}

Community sentiment: ${result.sentiment}

Simulation instructions: Model how users across these real-world use case categories adopt, engage with, and churn from ${result.tool}. Weight your agent personas toward the highest-frequency use cases. Use the actual user types listed above to ensure realistic persona distribution. Simulate realistic day 1, day 7, day 30, and day 90 retention curves based on what you know about how these real use case segments behave.`;
}

export default function ScraperPage() {
  const router = useRouter();
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
        name: `${result.tool} — community use case sim`,
        tags: ["use-case-scraper", result.tool.toLowerCase().replace(/\s+/g, "-")],
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
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem", fontFamily: "'Georgia', serif", color: "#1a1a1a", background: "#fafaf8", minHeight: "100vh" }}>

      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #1a1a1a", marginBottom: 24 }}>
        <div style={{ display: "flex" }}>
          {[
            { label: "Simulator", path: "/simulator" },
            { label: "Reddit Research", path: "/reddit" },
            { label: "Use Case Scraper", path: "/scraper" },
          ].map(tab => (
            <button key={tab.path} onClick={() => router.push(tab.path)} style={{ padding: "10px 20px", fontSize: 13, fontFamily: "system-ui", background: "transparent", border: "none", cursor: "pointer", color: tab.path === "/scraper" ? "#1a1a1a" : "#888", fontWeight: tab.path === "/scraper" ? 700 : 400, borderBottom: tab.path === "/scraper" ? "2px solid #1a1a1a" : "2px solid transparent", marginBottom: -2 }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Georgia', serif", margin: "4px 0 6px" }}>
          Use case scraper
        </h1>
        <p style={{ fontSize: 13, color: "#666", fontFamily: "system-ui", margin: 0 }}>
          Enter any tool, app, or SaaS — get back the top ways people are actually using it across Reddit, GitHub, Hacker News, X, and more.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: "2rem" }}>
        <input
          type="text"
          value={toolName}
          onChange={(e) => setToolName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="e.g. OpenClaw, Notion, Cursor, Linear..."
          style={{ flex: 1, padding: "10px 14px", fontSize: 14, fontFamily: "system-ui", border: "1px solid #e0e0d8", borderRadius: 4, outline: "none", background: "#fff", color: "#1a1a1a" }}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !toolName.trim()}
          style={{ padding: "10px 20px", fontSize: 13, fontFamily: "system-ui", fontWeight: 700, border: "none", borderRadius: 4, background: loading ? "#ccc" : "#1a1a1a", color: "#fff", cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
        >
          {loading ? "Searching…" : "Search →"}
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "#888", fontSize: 13, fontFamily: "system-ui" }}>
          Scanning Reddit, GitHub, Hacker News, and X for how people use <strong>{toolName}</strong>…
          <br />
          <span style={{ fontSize: 12, opacity: 0.7 }}>This takes ~15–30 seconds</span>
        </div>
      )}

      {error && (
        <div style={{ padding: "14px 16px", background: "#FCEBEB", color: "#791F1F", borderRadius: 4, fontSize: 13, fontFamily: "system-ui", border: "1px solid #F09595" }}>
          {error}
        </div>
      )}

      {result && (
        <div>
          {/* Summary row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
            {[
              { label: "Tool analyzed", value: result.tool },
              { label: "Use cases found", value: String(result.useCases?.length ?? 0) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#f0f0ec", padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#888", fontFamily: "system-ui", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
            <div style={{ background: "#f0f0ec", padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#888", fontFamily: "system-ui", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sentiment</div>
              <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 20, background: sentimentColor[result.sentiment]?.bg ?? "#eee", color: sentimentColor[result.sentiment]?.text ?? "#333", fontWeight: 700, fontFamily: "system-ui", display: "inline-block", marginTop: 2 }}>
                {result.sentiment}
              </span>
            </div>
          </div>

          {/* Key insight */}
          {result.keyInsight && (
            <div style={{ padding: "14px 16px", background: "#E6F1FB", borderLeft: "3px solid #378ADD", marginBottom: "1.5rem", fontSize: 13, fontFamily: "system-ui", color: "#0C447C", lineHeight: 1.6 }}>
              <strong>Key insight:</strong> {result.keyInsight}
            </div>
          )}

          {/* Primary communities */}
          {result.primaryCommunities?.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: 11, color: "#888", fontFamily: "system-ui", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Where discussion is happening</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.primaryCommunities.map((c, i) => (
                  <span key={i} style={{ fontSize: 12, padding: "4px 10px", background: "#E6F1FB", color: "#0C447C", border: "1px solid #B5D4F4", fontFamily: "system-ui", fontWeight: 700 }}>
                    {sourceLabel[c.toLowerCase()] ?? c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Send to simulator CTA */}
          <div style={{ padding: "16px 18px", background: saved ? "#E1F5EE" : "#fff", border: `1px solid ${saved ? "#9FE1CB" : "#e0e0d8"}`, marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, fontFamily: "system-ui", color: saved ? "#085041" : "#1a1a1a" }}>
                {saved ? "Saved to simulator prompt library ✓" : "Run a simulation from this data"}
              </div>
              <div style={{ fontSize: 12, fontFamily: "system-ui", color: saved ? "#0F6E56" : "#888" }}>
                {saved ? `Open the simulator and load "${result.tool} — community use case sim" from the prompt library` : "Builds a sim prompt grounded in real community use cases and saves it to your library"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {saved && (
                <a href="/simulator" style={{ padding: "8px 16px", fontSize: 13, fontFamily: "system-ui", fontWeight: 700, border: "none", background: "#1a1a1a", color: "#fff", textDecoration: "none", whiteSpace: "nowrap" }}>
                  Open simulator →
                </a>
              )}
              {!saved && (
                <div>
                  <button onClick={handleSendToSimulator} disabled={saving} style={{ padding: "8px 18px", fontSize: 13, fontFamily: "system-ui", fontWeight: 700, border: "1px solid #1a1a1a", background: saving ? "#f0f0ec" : "#fff", color: saving ? "#888" : "#1a1a1a", cursor: saving ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                    {saving ? "Saving…" : "Send to simulator →"}
                  </button>
                  {saveError && <div style={{ fontSize: 11, color: "#791F1F", marginTop: 4, fontFamily: "system-ui" }}>{saveError}</div>}
                </div>
              )}
            </div>
          </div>

          {/* User types */}
          {result.topUserTypes?.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: 11, color: "#888", fontFamily: "system-ui", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Top user types</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.topUserTypes.map((t, i) => (
                  <span key={i} style={{ fontSize: 12, padding: "4px 10px", background: "#f0f0ec", color: "#555", fontFamily: "system-ui", border: "1px solid #e0e0d8" }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Use case cards */}
          <div style={{ fontSize: 11, color: "#888", fontFamily: "system-ui", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Use cases</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.useCases?.map((uc, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #e0e0d8", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{uc.category}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", background: freqColor[uc.frequency]?.bg ?? "#eee", color: freqColor[uc.frequency]?.text ?? "#333", fontFamily: "system-ui", fontWeight: 700 }}>
                    {freqColor[uc.frequency]?.label ?? uc.frequency}
                  </span>
                </div>
                <p style={{ fontSize: 13, fontFamily: "system-ui", color: "#555", margin: "0 0 8px", lineHeight: 1.6 }}>
                  {uc.description}
                </p>
                {uc.exampleQuote && (
                  <div style={{ fontSize: 12, fontFamily: "system-ui", color: "#888", fontStyle: "italic", borderLeft: "2px solid #e0e0d8", paddingLeft: 10, marginBottom: 8, lineHeight: 1.5 }}>
                    "{uc.exampleQuote}"
                  </div>
                )}
                {uc.sources?.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {uc.sources.map((s, j) => (
                      <span key={j} style={{ fontSize: 11, padding: "2px 7px", background: "#f0f0ec", color: "#888", fontFamily: "system-ui", border: "1px solid #e0e0d8" }}>
                        {sourceLabel[s.toLowerCase()] ?? s}
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