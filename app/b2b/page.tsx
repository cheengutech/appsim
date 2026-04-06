"use client";
import { useState } from "react";

type BuyerSegment = "smb" | "mid" | "ent" | "mixed";
type SalesMotion = "plg" | "slg" | "hybrid";

interface SimResults {
  converted: number;
  cohort: number;
  finalARR: number;
  months: number;
  nrr: number;
  ltv: number;
  payback: number;
  monthlyChurn: number;
  expansionRate: number;
  arrByMonth: number[];
  healthy: number;
  atrisk: number;
  churned: number;
  expanding: number;
  risks: { title: string; desc: string; sev: "high" | "med" | "low" }[];
  segments: { name: string; count: number; arr: number; nrr: number }[];
  plgArr: number;
  slgArr: number;
  expArr: number;
  analysis?: string;
}

export default function B2BSimulator() {
  const [concept, setConcept] = useState("");
  const [buyer, setBuyer] = useState<BuyerSegment>("smb");
  const [motion, setMotion] = useState<SalesMotion>("plg");
  const [cohortN, setCohortN] = useState(200);
  const [months, setMonths] = useState(12);
  const [acvK, setAcvK] = useState(30);
  const [trial, setTrial] = useState(14);
  const [cycle, setCycle] = useState(30);
  const [friction, setFriction] = useState(4);
  const [champ, setChamp] = useState(6);
  const [roiVis, setRoiVis] = useState(5);
  const [results, setResults] = useState<SimResults | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  function runSim() {
    const acv = acvK * 1000;
    const motionMult = { plg: 1.1, slg: 0.9, hybrid: 1.0 }[motion];
    const trialConvRate = Math.min(0.55, 0.15 + (trial > 0 ? 0.1 : 0) + (friction <= 4 ? 0.1 : 0) + roiVis * 0.025);
    const baseConv = Math.min(0.7, trialConvRate * motionMult);
    const converted = Math.round(cohortN * baseConv);
    const monthlyChurn = Math.max(0.01, 0.12 - champ * 0.008 - roiVis * 0.005 - (friction <= 4 ? 0.01 : 0));
    const expansionRate = Math.min(0.25, 0.05 + champ * 0.015 + roiVis * 0.012);
    const nrr = Math.round((1 - monthlyChurn * 12 + expansionRate) * 100);

    const arrByMonth: number[] = [];
    let active = converted;
    for (let m = 1; m <= months; m++) {
      const newCo = m <= 3 ? Math.round(converted * 0.2) : Math.round(converted * 0.05);
      active = Math.round(active * (1 - monthlyChurn) + active * expansionRate / 12 + newCo);
      arrByMonth.push(Math.round(active * acv / 1000));
    }
    const finalARR = arrByMonth[arrByMonth.length - 1];
    const payback = Math.round(acv / (acv * 0.7) * 12);
    const ltv = Math.round(acv / (monthlyChurn * 12));

    const smb_c = buyer === "smb" ? Math.round(converted * 0.7) : buyer === "mixed" ? Math.round(converted * 0.4) : Math.round(converted * 0.1);
    const mid_c = buyer === "mid" ? Math.round(converted * 0.7) : buyer === "mixed" ? Math.round(converted * 0.4) : Math.round(converted * 0.2);
    const ent_c = buyer === "ent" ? Math.round(converted * 0.7) : buyer === "mixed" ? Math.round(converted * 0.2) : 0;
    const rest = converted - smb_c - mid_c - ent_c;

    const healthy = Math.round(converted * (0.3 + champ * 0.04 + roiVis * 0.03));
    const atrisk = Math.round(converted * (0.2 + friction * 0.025));
    const churned = Math.round(converted * monthlyChurn * months * 0.4);
    const expanding = Math.round(converted * expansionRate * 0.8);

    const plgArr = motion === "plg" ? finalARR * 0.65 : motion === "hybrid" ? finalARR * 0.45 : finalARR * 0.15;
    const slgArr = motion === "slg" ? finalARR * 0.65 : motion === "hybrid" ? finalARR * 0.35 : finalARR * 0.2;
    const expArr = Math.max(0, finalARR - plgArr - slgArr);

    const risks = [
      { title: "Champion departure", desc: "Single-threaded deals lose renewal when key contact leaves.", sev: (champ < 5 ? "high" : champ < 8 ? "med" : "low") as "high" | "med" | "low" },
      { title: "Onboarding drop-off", desc: "High friction creates early churn before value is realized.", sev: (friction > 7 ? "high" : friction > 4 ? "med" : "low") as "high" | "med" | "low" },
      { title: "ROI ambiguity", desc: "Companies that can't quantify value within 90 days churn 3× faster.", sev: (roiVis < 4 ? "high" : roiVis < 7 ? "med" : "low") as "high" | "med" | "low" },
      { title: "Expansion ceiling", desc: "SMB accounts may hit seat/usage limits without an upsell path.", sev: (buyer === "smb" ? "med" : "low") as "high" | "med" | "low" },
      { title: "Sales cycle lag", desc: `${cycle}d average cycle inflates CAC and delays cash flow.`, sev: (cycle > 90 ? "high" : cycle > 45 ? "med" : "low") as "high" | "med" | "low" },
    ];

    const segments = [
      { name: "SMB", count: smb_c + rest, arr: Math.round(acv * 0.6 / 1000), nrr: Math.round(nrr * 0.9) },
      { name: "Mid-market", count: mid_c, arr: Math.round(acv / 1000), nrr },
      { name: "Enterprise", count: ent_c, arr: Math.round(acv * 2.2 / 1000), nrr: Math.round(nrr * 1.1) },
    ].filter(s => s.count > 0);

    setResults({ converted, cohort: cohortN, finalARR, months, nrr, ltv, payback, monthlyChurn, expansionRate, arrByMonth, healthy, atrisk, churned, expanding, risks, segments, plgArr: Math.round(plgArr), slgArr: Math.round(slgArr), expArr: Math.round(expArr) });
  }

  async function analyzeResults() {
    if (!results) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/b2b-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, buyer, motion, results }),
      });
      const data = await res.json();
      setResults(r => r ? { ...r, analysis: data.analysis } : r);
    } catch (e) {
      console.error(e);
    }
    setAnalyzing(false);
  }

  const sevColor = { high: "bg-red-50 text-red-800", med: "bg-amber-50 text-amber-800", low: "bg-green-50 text-green-800" };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-medium mb-1 text-gray-900">B2B simulator</h1>
        <p className="text-sm text-gray-500 mb-6">Simulate how a cohort of companies adopts, expands, and churns on your product.</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Product concept</div>
            <textarea
              value={concept}
              onChange={e => setConcept(e.target.value)}
              className="w-full h-20 text-sm border border-gray-200 rounded-lg p-2 resize-none bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-300"
              placeholder="e.g. AI-powered sales coaching platform for mid-market teams"
            />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Target buyer</div>
            <div className="flex gap-2 mb-3">
              {(["smb", "mid", "ent", "mixed"] as BuyerSegment[]).map(b => (
                <button key={b} onClick={() => setBuyer(b)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${buyer === b ? "bg-blue-50 text-blue-800 border-blue-200" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {b === "smb" ? "SMB" : b === "mid" ? "Mid-market" : b === "ent" ? "Enterprise" : "Mixed"}
                </button>
              ))}
            </div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Sales motion</div>
            <div className="flex gap-2">
              {(["plg", "slg", "hybrid"] as SalesMotion[]).map(m => (
                <button key={m} onClick={() => setMotion(m)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${motion === m ? "bg-blue-50 text-blue-800 border-blue-200" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {m === "plg" ? "Product-led" : m === "slg" ? "Sales-led" : "Hybrid"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Parameters</div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              { label: "Companies in cohort", id: "cohort", val: cohortN, set: setCohortN, min: 50, max: 500, step: 50, fmt: (v: number) => String(v) },
              { label: "Simulation length (months)", id: "months", val: months, set: setMonths, min: 6, max: 24, step: 6, fmt: (v: number) => v + "mo" },
              { label: "ACV", id: "acv", val: acvK, set: setAcvK, min: 5, max: 200, step: 5, fmt: (v: number) => "$" + v + "K" },
              { label: "Free trial length (days)", id: "trial", val: trial, set: setTrial, min: 0, max: 90, step: 7, fmt: (v: number) => v === 0 ? "None" : v + "d" },
              { label: "Avg sales cycle (days)", id: "cycle", val: cycle, set: setCycle, min: 7, max: 180, step: 7, fmt: (v: number) => v + "d" },
              { label: "Onboarding friction (1–10)", id: "friction", val: friction, set: setFriction, min: 1, max: 10, step: 1, fmt: (v: number) => String(v) },
              { label: "Champion strength (1–10)", id: "champ", val: champ, set: setChamp, min: 1, max: 10, step: 1, fmt: (v: number) => String(v) },
              { label: "ROI visibility (1–10)", id: "roi", val: roiVis, set: setRoiVis, min: 1, max: 10, step: 1, fmt: (v: number) => String(v) },
            ].map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-52 flex-shrink-0">{p.label}</span>
                <input type="range" min={p.min} max={p.max} step={p.step} value={p.val}
                  onChange={e => p.set(Number(e.target.value))} className="flex-1" />
                <span className="text-sm font-medium text-gray-800 w-14 text-right">{p.fmt(p.val)}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={runSim}
          className="w-full py-3 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors mb-6">
          Run simulation
        </button>

        {results && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Converted companies", val: String(results.converted), sub: `of ${results.cohort} in cohort` },
                { label: "Final ARR", val: `$${results.finalARR}K`, sub: `at month ${results.months}` },
                { label: "Net revenue retention", val: `${results.nrr}%`, sub: "expansion vs churn" },
                { label: "Est. LTV", val: `$${Math.round(results.ltv / 1000)}K`, sub: `${results.payback}mo payback` },
              ].map(m => (
                <div key={m.label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                  <div className="text-xl font-medium text-gray-900">{m.val}</div>
                  <div className="text-xs text-gray-400 mt-1">{m.sub}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">ARR build over time ($K)</div>
                <div className="flex items-end gap-1 h-32">
                  {results.arrByMonth.map((v, i) => {
                    const max = Math.max(...results.arrByMonth);
                    const h = max > 0 ? Math.round((v / max) * 100) : 0;
                    return <div key={i} className="flex-1 bg-blue-400 rounded-sm" style={{ height: h + "%" }} title={`Mo ${i + 1}: $${v}K`} />;
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Mo 1</span><span>Mo {results.months}</span>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Company health</div>
                {[
                  { label: "Healthy", val: results.healthy, color: "bg-green-400" },
                  { label: "Expanding", val: results.expanding, color: "bg-blue-400" },
                  { label: "At risk", val: results.atrisk, color: "bg-amber-400" },
                  { label: "Churned", val: results.churned, color: "bg-red-400" },
                ].map(row => {
                  const total = results.healthy + results.expanding + results.atrisk + results.churned;
                  const pct = total > 0 ? Math.round((row.val / total) * 100) : 0;
                  return (
                    <div key={row.label} className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500 w-20">{row.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className={`${row.color} h-2 rounded-full`} style={{ width: pct + "%" }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-8 text-right">{row.val}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Churn risk register</div>
                <div className="space-y-2">
                  {results.risks.map(r => (
                    <div key={r.title} className="flex gap-2 items-start">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${sevColor[r.sev]}`}>{r.sev}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{r.title}</div>
                        <div className="text-xs text-gray-500">{r.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Cohort snapshot</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-100">
                      <th className="text-left pb-2">Segment</th>
                      <th className="text-left pb-2">Count</th>
                      <th className="text-left pb-2">Avg ARR</th>
                      <th className="text-left pb-2">NRR</th>
                      <th className="text-left pb-2">Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.segments.map(s => (
                      <tr key={s.name} className="border-b border-gray-50">
                        <td className="py-1.5 text-gray-800">{s.name}</td>
                        <td className="py-1.5 text-gray-700">{s.count}</td>
                        <td className="py-1.5 text-gray-700">${s.arr}K</td>
                        <td className="py-1.5 text-gray-700">{s.nrr}%</td>
                        <td className="py-1.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.nrr >= 110 ? "bg-green-50 text-green-800" : s.nrr >= 90 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"}`}>
                            {s.nrr >= 110 ? "strong" : s.nrr >= 90 ? "stable" : "at risk"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button onClick={analyzeResults} disabled={analyzing}
              className="w-full py-3 text-sm font-medium border border-gray-300 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50">
              {analyzing ? "Analyzing..." : "Get strategic analysis"}
            </button>

            {results.analysis && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Strategic analysis</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{results.analysis}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}