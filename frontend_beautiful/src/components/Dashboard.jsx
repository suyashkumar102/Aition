import React, { useState, useRef } from "react";
import {
  Upload, Database, AlertTriangle, Shield, ShieldAlert,
  Check, Share2, Users, Tag, Lightbulb, HelpCircle,
  ArrowRight, BarChart3, Sparkles, Loader2, FileText,
  Home, ShieldCheck, CheckCircle2, Settings as SettingsIcon,
  Download, RefreshCw, Info, TrendingDown,
} from "lucide-react";
import Sidebar from "./Sidebar";
import CausalGraph from "./CausalGraph";
import { runAudit, runDebias } from "../api";

function fmt(n, dp = 4) {
  return typeof n === "number" ? n.toFixed(dp) : "—";
}
function pct(n) {
  return typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—";
}
function markdownToHtml(md) {
  if (!md) return "";
  return md
    .replace(/^### (.+)$/gm, '<h4 style="color:#a48bff;margin:16px 0 6px;font-size:14px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:#e6e8f0;margin:20px 0 8px;font-size:16px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="color:#ffffff;margin:24px 0 10px;font-size:18px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#ffffff">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => `<ul style="padding-left:20px;margin:8px 0">${m}</ul>`)
    .replace(/\n\n/g, "<br/><br/>");
}

// ── page titles per tab ───────────────────────────────────────────────────────
const PAGE_META = {
  "overview":       { title: "Causal AI Fairness Engine",  sub: "Detecting hidden bias. Enabling fairer outcomes." },
  "fairness-audit": { title: "Fairness Audit",             sub: "Standard vs causal fairness comparison." },
  "causal-graph":   { title: "Causal Graph",               sub: "How your model actually makes decisions." },
  "debiasing":      { title: "Surgical Debiasing",         sub: "Remove proxy bias without full retraining." },
  "reports":        { title: "Audit Report",               sub: "Plain-language findings for stakeholders." },
  "dataset":        { title: "Dataset",                    sub: "Loaded dataset statistics and schema." },
  "settings":       { title: "Settings",                   sub: "Configure fairness definitions and preferences." },
};

export default function Dashboard() {
  const [active, setActive] = useState("overview");
  const [auditData, setAuditData]         = useState(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [debias, setDebias]               = useState(null);
  const [debiasLoading, setDebiasLoading] = useState(false);
  const [debiasError, setDebiasError]     = useState(null);
  const [fairnessDef, setFairnessDef]     = useState("equalized_odds");
  const [sliderIdx, setSliderIdx]         = useState(8);
  const fileInputRef = useRef(null);

  const std    = auditData?.standard_audit;
  const causal = auditData?.causal_audit;
  const graph  = auditData?.graph_data;
  const surf   = auditData?.impossibility_surface;
  const proxyVars = causal?.paths?.map(p => p.path[1]) ?? [];
  const surfPoint = surf?.frontier_points?.[sliderIdx];
  const surfAcc   = surf?.accuracy_at_threshold?.[sliderIdx];
  const dpDisplay  = surfPoint ? fmt(surfPoint[0], 3) : "—";
  const eodDisplay = surfPoint ? fmt(surfPoint[1], 3) : "—";
  const accDisplay = surfAcc   ? `${(surfAcc * 100).toFixed(1)}%` : "—";

  async function handleAudit(file = null) {
    setLoading(true); setError(null); setAuditData(null); setDebias(null);
    try { setAuditData(await runAudit(file)); setActive("overview"); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function handleDebias() {
    if (!auditData?.audit_id) return;
    setDebiasLoading(true); setDebiasError(null);
    try { setDebias(await runDebias(auditData.audit_id, fairnessDef)); }
    catch (e) { setDebiasError(e.message); }
    finally { setDebiasLoading(false); }
  }
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) handleAudit(file);
    e.target.value = "";
  }

  const meta = PAGE_META[active] || PAGE_META["overview"];

  return (
    <div className="app-bg" style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active={active} onChange={setActive} />
      <main className="main-area" style={{ flex: 1, padding: "32px 40px 60px", maxWidth: "100%", minWidth: 0 }}>

        {/* Header */}
        <div className="header-flex fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, gap: 24 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, color: "#ffffff", letterSpacing: -0.6 }}>{meta.title}</h1>
            <p style={{ margin: "8px 0 0", color: "#8a8fa8", fontSize: 14 }}>{meta.sub}</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFileChange} />
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <Upload size={16} /> Upload CSV
            </button>
            <button className="btn btn-primary" onClick={() => handleAudit(null)} disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : <Database size={16} />}
              {loading ? "Running Audit…" : "Use Demo Dataset"}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 12, padding: "14px 20px", marginBottom: 20, color: "#ff8585", fontSize: 14 }}>
            ⚠ {error}
          </div>
        )}
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#8a8fa8" }}>
            <Loader2 size={40} style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
            <div style={{ fontSize: 16 }}>Running causal audit…</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Building causal graph, computing fairness metrics</div>
          </div>
        )}

        {!loading && !auditData && !error && (
          <EmptyState onDemo={() => handleAudit(null)} onUpload={() => fileInputRef.current?.click()} />
        )}

        {!loading && auditData && (
          <>
            {active === "overview"       && <TabOverview std={std} causal={causal} graph={graph} surf={surf} debias={debias} debiasLoading={debiasLoading} debiasError={debiasError} fairnessDef={fairnessDef} setFairnessDef={setFairnessDef} sliderIdx={sliderIdx} setSliderIdx={setSliderIdx} dpDisplay={dpDisplay} eodDisplay={eodDisplay} accDisplay={accDisplay} surfAcc={surfAcc} proxyVars={proxyVars} handleDebias={handleDebias} auditData={auditData} />}
            {active === "fairness-audit" && <TabFairnessAudit std={std} causal={causal} proxyVars={proxyVars} />}
            {active === "causal-graph"   && <TabCausalGraph graph={graph} causal={causal} />}
            {active === "debiasing"      && <TabDebiasing debias={debias} debiasLoading={debiasLoading} debiasError={debiasError} fairnessDef={fairnessDef} setFairnessDef={setFairnessDef} sliderIdx={sliderIdx} setSliderIdx={setSliderIdx} dpDisplay={dpDisplay} eodDisplay={eodDisplay} accDisplay={accDisplay} surfAcc={surfAcc} surf={surf} handleDebias={handleDebias} auditData={auditData} />}
            {active === "reports"        && <TabReports auditData={auditData} />}
            {active === "dataset"        && <TabDataset auditData={auditData} />}
            {active === "settings"       && <TabSettings fairnessDef={fairnessDef} setFairnessDef={setFairnessDef} />}
          </>
        )}
      </main>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ onDemo, onUpload }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 0", color: "#8a8fa8" }}>
      <Database size={48} style={{ margin: "0 auto 20px", opacity: 0.4 }} />
      <div style={{ fontSize: 18, fontWeight: 600, color: "#c7cae0", marginBottom: 8 }}>No audit loaded</div>
      <div style={{ fontSize: 14, marginBottom: 28 }}>Run the demo dataset or upload your own CSV to begin.</div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button className="btn btn-primary" onClick={onDemo}><Database size={15} /> Use Demo Dataset</button>
        <button className="btn btn-secondary" onClick={onUpload}><Upload size={15} /> Upload CSV</button>
      </div>
    </div>
  );
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────
function TabOverview({ std, causal, graph, surf, debias, debiasLoading, debiasError, fairnessDef, setFairnessDef, sliderIdx, setSliderIdx, dpDisplay, eodDisplay, accDisplay, surfAcc, proxyVars, handleDebias, auditData }) {
  return (
    <>
      {/* Alert */}
      <div className="alert-danger fade-up fade-up-d1" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div className="pulse-glow" style={{ width: 50, height: 50, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ff5d5d", flexShrink: 0 }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ color: "#ffffff", fontSize: 18, fontWeight: 600 }}>{causal?.verdict ?? "Audit Complete"}</div>
            <div style={{ color: "#c79ba1", fontSize: 13.5, marginTop: 4 }}>
              {causal?.proxy_paths_found > 0 ? "Your model is indirectly using sensitive signals through proxy variables." : "No proxy discrimination paths detected."}
            </div>
          </div>
        </div>
        <div className="danger-badge">
          <div style={{ fontSize: 28, fontWeight: 700, color: "#ff7a7a", lineHeight: 1 }}>{causal?.affected_candidates ?? "—"}</div>
          <div style={{ fontSize: 11.5, color: "#c79ba1", marginTop: 6 }}>candidates affected</div>
        </div>
      </div>

      {/* Top grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr", gap: 20, marginBottom: 24 }}>
        <FairnessCard std={std} />
        <CausalCard causal={causal} />
        <InsightsCard causal={causal} proxyVars={proxyVars} />
        <div className="card fade-up" style={{ gridColumn: "span 2" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
            <div className="card-title">Causal Graph</div>
            <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "#c7cae0", flexWrap: "wrap" }}>
              <Legend color="#7c5cff" label="Protected" /><Legend color="#ef4444" label="Proxy" /><Legend color="#10b981" label="Legitimate" /><Legend color="#9aa0b9" label="Outcome" />
            </div>
          </div>
          <div className="graph-container" style={{ height: 340 }}><CausalGraph graphData={graph} /></div>
        </div>
      </div>

      {/* Bottom grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <DebiasingCard debias={debias} debiasLoading={debiasLoading} debiasError={debiasError} handleDebias={handleDebias} auditData={auditData} />
        <ImpossibilityCard surf={surf} sliderIdx={sliderIdx} setSliderIdx={setSliderIdx} dpDisplay={dpDisplay} eodDisplay={eodDisplay} accDisplay={accDisplay} surfAcc={surfAcc} fairnessDef={fairnessDef} setFairnessDef={setFairnessDef} handleDebias={handleDebias} debiasLoading={debiasLoading} auditData={auditData} />
      </div>

      {auditData?.plain_language_report && (
        <div className="card fade-up" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <FileText size={18} color="#a48bff" />
            <div className="card-title">Plain Language Report</div>
            {auditData.report_error && <span style={{ fontSize: 12, color: "#facc15", marginLeft: 8 }}>(fallback)</span>}
          </div>
          <div style={{ color: "#c7cae0", fontSize: 14, lineHeight: 1.8, maxHeight: 300, overflowY: "auto" }}
            dangerouslySetInnerHTML={{ __html: markdownToHtml(auditData.plain_language_report) }} />
        </div>
      )}
    </>
  );
}

// ── Tab: Fairness Audit ───────────────────────────────────────────────────────
function TabFairnessAudit({ std, causal, proxyVars }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <FairnessCard std={std} />
        <CausalCard causal={causal} />
      </div>

      {/* Proxy paths detail */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 18 }}>Proxy Discrimination Paths</div>
        {causal?.paths?.length > 0 ? causal.paths.map((p, i) => (
          <div key={i} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "16px 20px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ background: "rgba(239,68,68,0.15)", color: "#ff7a7a", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>PATH {i + 1}</span>
              <span style={{ color: "#ff9a9a", fontSize: 13, fontFamily: "monospace" }}>{p.path.join(" → ")}</span>
            </div>
            <div style={{ color: "#8a8fa8", fontSize: 12.5 }}>{p.description}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#facc15" }}>Effect size: <strong>{fmt(p.effect, 3)}</strong></div>
          </div>
        )) : (
          <div style={{ color: "#34d399", fontSize: 14 }}>✓ No proxy discrimination paths detected.</div>
        )}
      </div>

      {/* Comparison table */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 18 }}>Standard vs Causal Audit Comparison</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", color: "#8a8fa8", fontWeight: 500 }}>Metric</th>
              <th style={{ textAlign: "center", padding: "8px 12px", color: "#34d399", fontWeight: 600 }}>Standard (AIF360)</th>
              <th style={{ textAlign: "center", padding: "8px 12px", color: "#ff7a7a", fontWeight: 600 }}>Causal (Aition)</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Verdict", std?.verdict ?? "—", causal?.verdict ?? "—"],
              ["Age DPD", fmt(std?.demographic_parity_difference), "—"],
              ["SES DPD", fmt(std?.ses_parity_difference), "—"],
              ["Proxy paths found", "0", String(causal?.proxy_paths_found ?? "—")],
              ["Candidates affected", "Not detected", String(causal?.affected_candidates ?? "—")],
              ["Causal effect", "Not measured", fmt(causal?.total_causal_effect_of_gender, 3)],
            ].map(([label, a, b]) => (
              <tr key={label} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td style={{ padding: "10px 12px", color: "#c7cae0" }}>{label}</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#34d399", fontFamily: "monospace" }}>{a}</td>
                <td style={{ padding: "10px 12px", textAlign: "center", color: "#ff9a9a", fontFamily: "monospace" }}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab: Causal Graph ─────────────────────────────────────────────────────────
function TabCausalGraph({ graph, causal }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div className="card-title">Full Causal Graph</div>
          <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "#c7cae0", flexWrap: "wrap" }}>
            <Legend color="#7c5cff" label="Protected" /><Legend color="#ef4444" label="Proxy" /><Legend color="#10b981" label="Legitimate" /><Legend color="#9aa0b9" label="Outcome" />
          </div>
        </div>
        <div className="graph-container" style={{ height: 460 }}><CausalGraph graphData={graph} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Graph Summary</div>
          {[
            ["Total nodes", graph?.nodes?.length ?? "—"],
            ["Total edges", graph?.edges?.length ?? "—"],
            ["Protected nodes", graph?.nodes?.filter(n => n.type === "protected").length ?? "—"],
            ["Proxy nodes", graph?.nodes?.filter(n => n.type === "proxy").length ?? "—"],
            ["Legitimate nodes", graph?.nodes?.filter(n => n.type === "legitimate").length ?? "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
              <span style={{ color: "#8a8fa8" }}>{k}</span>
              <span style={{ color: "#e6e8f0", fontFamily: "monospace", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Edge Strengths</div>
          {graph?.edges?.map((e, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
              <span style={{ color: e.type === "proxy" ? "#ff9a9a" : "#6ee7b7", fontFamily: "monospace" }}>{e.source} → {e.target}</span>
              <span style={{ color: "#facc15", fontWeight: 600 }}>{e.strength}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Debiasing ────────────────────────────────────────────────────────────
function TabDebiasing({ debias, debiasLoading, debiasError, fairnessDef, setFairnessDef, sliderIdx, setSliderIdx, dpDisplay, eodDisplay, accDisplay, surfAcc, surf, handleDebias, auditData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <DebiasingCard debias={debias} debiasLoading={debiasLoading} debiasError={debiasError} handleDebias={handleDebias} auditData={auditData} />
        <ImpossibilityCard surf={surf} sliderIdx={sliderIdx} setSliderIdx={setSliderIdx} dpDisplay={dpDisplay} eodDisplay={eodDisplay} accDisplay={accDisplay} surfAcc={surfAcc} fairnessDef={fairnessDef} setFairnessDef={setFairnessDef} handleDebias={handleDebias} debiasLoading={debiasLoading} auditData={auditData} />
      </div>

      {debias && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 18 }}>Debiasing Strategy Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              ["Strategy", debias.strategy_applied, "#a48bff"],
              ["Fairness Definition", debias.selected_fairness_definition, "#7c5cff"],
              ["Bias Reduction", `${debias.bias_reduction_percent}%`, "#34d399"],
              ["Accuracy Cost", `${debias.accuracy_cost_percent}%`, "#facc15"],
              ["Bias Before", fmt(debias.bias_index_before), "#ff7a7a"],
              ["Bias After", fmt(debias.bias_index_after), "#34d399"],
            ].map(([k, v, col]) => (
              <div key={k} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, color: "#8a8fa8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{k}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: col, fontFamily: "monospace" }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, color: "#8a8fa8", marginBottom: 8 }}>Variables modified:</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {debias.variables_modified.map(v => <span key={v} className="chip chip-purple">{v}</span>)}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Info size={16} color="#a48bff" />
          <div className="card-title" style={{ fontSize: 15 }}>About Surgical Debiasing</div>
        </div>
        <div style={{ color: "#8a8fa8", fontSize: 13, lineHeight: 1.7 }}>
          Aition's surgical debiasing removes only the discriminatory proxy variables from the feature set and reweights samples to equalise proxy variable distributions across protected groups. Unlike full model retraining, this approach preserves legitimate predictive signals while eliminating the causal paths that carry bias.
        </div>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[["Proxy Removal", "Drops college_graduation_year_gap and neighborhood_quality"], ["Reweighting", "Equalises employment_gap distribution across age groups"], ["Retrain", "Logistic regression on clean features with sample weights"]].map(([t, d]) => (
            <div key={t} style={{ background: "rgba(124,92,255,0.06)", border: "1px solid rgba(124,92,255,0.15)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#a48bff", marginBottom: 6 }}>{t}</div>
              <div style={{ fontSize: 11.5, color: "#8a8fa8", lineHeight: 1.5 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Reports ──────────────────────────────────────────────────────────────
function TabReports({ auditData }) {
  function copyReport() {
    navigator.clipboard?.writeText(auditData?.plain_language_report ?? "");
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={18} color="#a48bff" />
            <div className="card-title">Plain Language Audit Report</div>
            {auditData?.report_error && <span style={{ fontSize: 12, color: "#facc15" }}>(fallback — Gemini unavailable)</span>}
          </div>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: "8px 14px" }} onClick={copyReport}>
            <Download size={14} /> Copy Report
          </button>
        </div>
        {auditData?.plain_language_report ? (
          <div style={{ color: "#c7cae0", fontSize: 14, lineHeight: 1.9, maxHeight: 600, overflowY: "auto", padding: "0 4px" }}
            dangerouslySetInnerHTML={{ __html: markdownToHtml(auditData.plain_language_report) }} />
        ) : (
          <div style={{ color: "#8a8fa8", fontSize: 14 }}>No report available. Run an audit first.</div>
        )}
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 14 }}>Audit Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            ["Audit ID", auditData?.audit_id?.slice(0, 8) + "…", "#a48bff"],
            ["Standard Verdict", auditData?.standard_audit?.verdict ?? "—", auditData?.standard_audit?.passes_standard_test ? "#34d399" : "#ff7a7a"],
            ["Causal Verdict", auditData?.causal_audit?.proxy_paths_found > 0 ? "BIASED" : "FAIR", auditData?.causal_audit?.proxy_paths_found > 0 ? "#ff7a7a" : "#34d399"],
            ["Affected", String(auditData?.causal_audit?.affected_candidates ?? "—"), "#facc15"],
          ].map(([k, v, col]) => (
            <div key={k} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#8a8fa8", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>{k}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: col, fontFamily: "monospace", wordBreak: "break-all" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Dataset ──────────────────────────────────────────────────────────────
function TabDataset({ auditData }) {
  const causal = auditData?.causal_audit;
  const std    = auditData?.standard_audit;
  const graph  = auditData?.graph_data;
  const cols   = graph?.nodes?.map(n => ({ name: n.label, id: n.id, type: n.type })) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {[
          ["Rows", "2,000", "#a48bff"],
          ["Protected Attrs", "2", "#7c5cff"],
          ["Proxy Variables", String(causal?.proxy_paths_found ?? "—"), "#ef4444"],
          ["Legitimate Features", "2", "#10b981"],
        ].map(([k, v, col]) => (
          <div key={k} className="card" style={{ textAlign: "center", padding: "20px 16px" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: col }}>{v}</div>
            <div style={{ fontSize: 12, color: "#8a8fa8", marginTop: 6 }}>{k}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>Dataset Schema</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {["Column", "Type", "Role"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#8a8fa8", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["age_group", "categorical", "protected", "#7c5cff"],
              ["socioeconomic_group", "categorical", "protected", "#7c5cff"],
              ["experience_years", "numeric", "legitimate", "#10b981"],
              ["test_score", "numeric", "legitimate", "#10b981"],
              ["college_graduation_year_gap", "binary", "proxy", "#ef4444"],
              ["employment_gap", "binary", "proxy", "#ef4444"],
              ["neighborhood_quality", "binary", "proxy", "#ef4444"],
              ["hired", "binary", "outcome", "#9aa0b9"],
            ].map(([col, type, role, col_]) => (
              <tr key={col} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td style={{ padding: "10px 12px", color: "#e6e8f0", fontFamily: "monospace", fontSize: 12 }}>{col}</td>
                <td style={{ padding: "10px 12px", color: "#8a8fa8" }}>{type}</td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{ background: `${col_}22`, color: col_, border: `1px solid ${col_}44`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{role}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 14 }}>Fairness Statistics</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            ["Age DPD (standard)", fmt(std?.demographic_parity_difference), "Passes 0.10 threshold"],
            ["SES DPD (standard)", fmt(std?.ses_parity_difference), "Passes 0.10 threshold"],
            ["Proxy paths (causal)", String(causal?.proxy_paths_found ?? "—"), "Found by Aition"],
            ["Causal effect", fmt(causal?.total_causal_effect_of_gender, 3), "Combined age + SES"],
          ].map(([k, v, note]) => (
            <div key={k} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#8a8fa8", marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e6e8f0", fontFamily: "monospace" }}>{v}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Settings ─────────────────────────────────────────────────────────────
function TabSettings({ fairnessDef, setFairnessDef }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 700 }}>
      <div className="card">
        <div className="card-title" style={{ marginBottom: 6 }}>Fairness Definition</div>
        <div style={{ color: "#7d83a0", fontSize: 12.5, fontStyle: "italic", marginBottom: 20 }}>
          Chouldechova (2017): these definitions are mathematically incompatible when base rates differ.
        </div>
        {[
          ["demographic_parity", "Demographic Parity", "Equal approval rates across groups. P(Ŷ=1|A=0) = P(Ŷ=1|A=1)"],
          ["equalized_odds", "Equalized Odds", "Equal error rates (TPR and FPR) across groups."],
        ].map(([val, label, desc]) => (
          <div key={val} onClick={() => setFairnessDef(val)} style={{ cursor: "pointer", background: fairnessDef === val ? "rgba(124,92,255,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${fairnessDef === val ? "rgba(124,92,255,0.4)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "16px 18px", marginBottom: 12, transition: "all 200ms" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${fairnessDef === val ? "#7c5cff" : "#4b5563"}`, background: fairnessDef === val ? "#7c5cff" : "transparent", flexShrink: 0 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: fairnessDef === val ? "#a48bff" : "#c7cae0" }}>{label}</div>
            </div>
            <div style={{ fontSize: 12, color: "#8a8fa8", marginTop: 6, marginLeft: 26 }}>{desc}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 14 }}>About Aition</div>
        <div style={{ color: "#8a8fa8", fontSize: 13, lineHeight: 1.7 }}>
          <strong style={{ color: "#e6e8f0" }}>αἴτιον</strong> (aítion) — Ancient Greek for <em>cause, the answer to "Why?"</em><br /><br />
          Aition is a Causal AI Fairness Engine built for Google Solution Challenge 2026 India. It detects proxy discrimination — the hidden bias that passes every standard fairness test — using DoWhy causal graphs and the backdoor criterion.<br /><br />
          <strong style={{ color: "#e6e8f0" }}>Team:</strong> Jugaad.exe &nbsp;·&nbsp; <strong style={{ color: "#e6e8f0" }}>Leader:</strong> Suyash Kumar
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {["DoWhy 0.11", "AIF360 0.6", "Gemini 2.5 Flash", "FastAPI", "React 18"].map(t => (
            <span key={t} className="chip chip-purple">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shared card components ────────────────────────────────────────────────────

function FairnessCard({ std }) {
  return (
    <div className="card fair-card fade-up fade-up-d2">
      <div className="card-title" style={{ marginBottom: 22 }}>Standard Fairness (AIF360)</div>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div className={`shield-circle ${std?.passes_standard_test ? "shield-fair" : "shield-danger"}`}>
          {std?.passes_standard_test ? <Shield size={28} /> : <ShieldAlert size={28} />}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700 }} className={std?.passes_standard_test ? "status-fair" : "status-not-fair"}>
              {std?.verdict ?? "—"}
            </span>
            {std?.passes_standard_test && <Check size={22} color="#34d399" strokeWidth={3} />}
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className="card-subtle">Age DPD</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginTop: 4 }}>{fmt(std?.demographic_parity_difference)}</div>
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 12.5, color: "#8a8fa8", display: "flex", gap: 16 }}>
        <span>Age: <span style={{ color: "#34d399" }}>{fmt(std?.demographic_parity_difference)}</span></span>
        <span>SES: <span style={{ color: "#34d399" }}>{fmt(std?.ses_parity_difference)}</span></span>
      </div>
    </div>
  );
}

function CausalCard({ causal }) {
  return (
    <div className="card not-fair-card fade-up fade-up-d3">
      <div className="card-title" style={{ marginBottom: 22 }}>Causal Fairness (DoWhy)</div>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div className="shield-circle shield-danger"><ShieldAlert size={28} /></div>
        <div>
          <span style={{ fontSize: 20, fontWeight: 700 }} className="status-not-fair">{causal?.verdict ?? "—"}</span>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className="card-subtle">Proxy Paths</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginTop: 4 }}>{causal?.proxy_paths_found ?? "—"}</div>
        </div>
      </div>
      <div style={{ marginTop: 16, fontSize: 12.5, color: "#ff7a7a" }}>
        {causal?.affected_candidates ?? "—"} affected · effect: {fmt(causal?.total_causal_effect_of_gender, 3)}
      </div>
    </div>
  );
}

function InsightsCard({ causal, proxyVars }) {
  return (
    <div className="card insights-col fade-up fade-up-d4" style={{ gridRow: "span 2" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <Sparkles size={18} color="#a48bff" />
        <div className="card-title" style={{ fontSize: 16 }}>Key Insights</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="insight-tile">
          <div className="insight-icon"><Share2 size={17} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{causal?.proxy_paths_found ?? "—"} Proxy Paths</div>
            <div style={{ fontSize: 12, color: "#8a8fa8", marginTop: 3 }}>Detected in causal graph</div>
          </div>
        </div>
        <div className="insight-tile">
          <div className="insight-icon"><Users size={17} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{causal?.affected_candidates ?? "—"} Affected</div>
            <div style={{ fontSize: 12, color: "#8a8fa8", marginTop: 3 }}>May be unfairly impacted</div>
          </div>
        </div>
        <div className="insight-tile">
          <div className="insight-icon insight-icon-pink"><Tag size={17} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Proxy Variables</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {proxyVars.length > 0 ? proxyVars.map(v => <span key={v} className="chip chip-red">{v}</span>) : <span style={{ color: "#8a8fa8", fontSize: 12 }}>None</span>}
            </div>
          </div>
        </div>
        <div className="insight-tile">
          <div className="insight-icon insight-icon-yellow"><Lightbulb size={17} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Recommendation</div>
            <div style={{ fontSize: 12, color: "#8a8fa8", marginTop: 3, lineHeight: 1.5 }}>
              {causal?.proxy_paths_found > 0 ? "Apply surgical debiasing to remove proxy influence." : "Model appears causally fair."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DebiasingCard({ debias, debiasLoading, debiasError, handleDebias, auditData }) {
  return (
    <div className="card fade-up fade-up-d4">
      <div className="card-title" style={{ marginBottom: 22 }}>Surgical Debiasing Impact</div>
      {debias ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 1fr", gap: 18, alignItems: "center" }}>
            <div>
              <div style={{ color: "#ff5d5d", fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>BEFORE</div>
              <div style={{ marginTop: 14, color: "#8a8fa8", fontSize: 12.5 }}>Bias Score</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#ff5d5d", marginTop: 2 }}>{fmt(debias.bias_index_before)}</div>
              <div style={{ marginTop: 14, color: "#8a8fa8", fontSize: 12.5 }}>Accuracy</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#fff", marginTop: 2 }}>{pct(debias.accuracy_before)}</div>
              <div className="progress-bar" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${(debias.accuracy_before * 100).toFixed(0)}%`, background: "linear-gradient(90deg, #ef4444, #ff7a7a)" }} />
              </div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a48bff" }}>
              <ArrowRight size={16} />
            </div>
            <div>
              <div style={{ color: "#34d399", fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>AFTER</div>
              <div style={{ marginTop: 14, color: "#8a8fa8", fontSize: 12.5 }}>Bias Score</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#34d399", marginTop: 2 }}>{fmt(debias.bias_index_after)}</div>
              <div style={{ marginTop: 14, color: "#8a8fa8", fontSize: 12.5 }}>Accuracy</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#fff", marginTop: 2 }}>{pct(debias.accuracy_after)}</div>
              <div className="progress-bar" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${(debias.accuracy_after * 100).toFixed(0)}%`, background: "linear-gradient(90deg, #10b981, #6ee7b7)" }} />
              </div>
            </div>
            <div className="metric-highlight">
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#34d399" }}>
                <BarChart3 size={16} /><span style={{ fontSize: 13, fontWeight: 500 }}>Bias Reduction</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#34d399", marginTop: 6 }}>{debias.bias_reduction_percent}%</div>
              <div style={{ marginTop: 16, color: "#facc15", fontSize: 13, fontWeight: 500 }}>Accuracy Cost</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#facc15", marginTop: 6 }}>{debias.accuracy_cost_percent}%</div>
            </div>
          </div>
          <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ color: "#8a8fa8", fontSize: 13 }}>Removed:</span>
            {debias.variables_modified.map(v => <span key={v} className="chip chip-purple">{v}</span>)}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#8a8fa8" }}>
          <div style={{ fontSize: 14, marginBottom: 20 }}>Run debiasing to see before/after comparison</div>
          {debiasError && <div style={{ color: "#ff8585", fontSize: 13, marginBottom: 16 }}>⚠ {debiasError}</div>}
          <button className="btn btn-primary" onClick={handleDebias} disabled={debiasLoading || !auditData}>
            {debiasLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {debiasLoading ? "Debiasing…" : "Run Surgical Debiasing"}
          </button>
        </div>
      )}
    </div>
  );
}

function ImpossibilityCard({ surf, sliderIdx, setSliderIdx, dpDisplay, eodDisplay, accDisplay, surfAcc, fairnessDef, setFairnessDef, handleDebias, debiasLoading, auditData }) {
  return (
    <div className="card fade-up fade-up-d5">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div className="card-title">Fairness Definition Selector</div>
        <HelpCircle size={15} color="#7d83a0" />
      </div>
      <div style={{ color: "#7d83a0", fontSize: 12.5, fontStyle: "italic", marginBottom: 22 }}>
        These definitions are mathematically incompatible. (Chouldechova 2017)
      </div>
      {surf ? (
        <>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8a8fa8", marginBottom: 10 }}>
              <span>← More Demographic Parity</span><span>More Equalized Odds →</span>
            </div>
            <input type="range" min={0} max={16} step={1} value={sliderIdx}
              onChange={e => setSliderIdx(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#7c5cff", cursor: "pointer", height: 6 }} />
          </div>
          <SliderDisplay label="Demographic Parity" value={dpDisplay} pct={sliderIdx / 16} color="#7c5cff" />
          <SliderDisplay label="Equalized Odds"     value={eodDisplay} pct={1 - sliderIdx / 16} color="#3b82f6" />
          <SliderDisplay label="Model Accuracy"     value={accDisplay} pct={surfAcc ?? 0.85} color="#10b981" />
          <div style={{ color: "#7d83a0", fontSize: 12.5, fontStyle: "italic", margin: "20px 0 22px", lineHeight: 1.5 }}>
            Moving toward Equalized Odds may reduce accuracy but improves error rate parity.
          </div>
        </>
      ) : (
        <div style={{ color: "#8a8fa8", fontSize: 13, marginBottom: 22 }}>Run an audit to see the impossibility surface.</div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {["demographic_parity", "equalized_odds"].map(def => (
          <button key={def} onClick={() => setFairnessDef(def)}
            className={`btn ${fairnessDef === def ? "btn-primary" : "btn-secondary"}`}
            style={{ fontSize: 12, padding: "8px 14px" }}>
            {def === "demographic_parity" ? "Demographic Parity" : "Equalized Odds"}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" onClick={handleDebias} disabled={debiasLoading || !auditData}>
        {debiasLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
        {debiasLoading ? "Applying…" : "Apply Selected Fairness"}
      </button>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span className="legend-dot" style={{ background: color }} />{label}
    </span>
  );
}

function SliderDisplay({ label, value, pct, color }) {
  const fillPct = Math.min(1, Math.max(0, typeof pct === "number" ? pct : 0.5));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 70px", gap: 16, alignItems: "center", marginBottom: 18 }}>
      <div style={{ color: "#c7cae0", fontSize: 13.5 }}>{label}</div>
      <div className="slider-track">
        <div className="slider-fill" style={{ width: `${(fillPct * 100).toFixed(1)}%`, background: `linear-gradient(90deg, ${color}aa, ${color})` }} />
        <div className="slider-thumb" style={{ left: `${(fillPct * 100).toFixed(1)}%`, color }} />
      </div>
      <div style={{ color: "#e6e8f0", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>{value}</div>
    </div>
  );
}
