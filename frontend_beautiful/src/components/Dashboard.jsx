import React, { useState, useRef } from "react";
import {
  Upload, Database, AlertTriangle, Shield, ShieldAlert,
  Check, Share2, Users, Tag, Lightbulb, HelpCircle,
  ArrowRight, BarChart3, Sparkles, Loader2, FileText,
} from "lucide-react";
import Sidebar from "./Sidebar";
import CausalGraph from "./CausalGraph";
import { runAudit, runDebias } from "../api";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n, dp = 4) {
  return typeof n === "number" ? n.toFixed(dp) : "—";
}

function pct(n) {
  return typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—";
}

// ── main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [active, setActive] = useState("overview");

  // audit state
  const [auditData, setAuditData]     = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  // debiasing state
  const [debias, setDebias]           = useState(null);
  const [debiasLoading, setDebiasLoading] = useState(false);
  const [debiasError, setDebiasError] = useState(null);
  const [fairnessDef, setFairnessDef] = useState("equalized_odds");

  // slider display values (impossibility surface)
  const [sliderIdx, setSliderIdx]     = useState(8); // middle of 17 steps

  const fileInputRef = useRef(null);

  // ── API calls ───────────────────────────────────────────────────────────────

  async function handleAudit(file = null) {
    setLoading(true);
    setError(null);
    setAuditData(null);
    setDebias(null);
    try {
      const data = await runAudit(file);
      setAuditData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDebias() {
    if (!auditData?.audit_id) return;
    setDebiasLoading(true);
    setDebiasError(null);
    try {
      const result = await runDebias(auditData.audit_id, fairnessDef);
      setDebias(result);
    } catch (e) {
      setDebiasError(e.message);
    } finally {
      setDebiasLoading(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) handleAudit(file);
    e.target.value = "";
  }

  // ── derived display values ──────────────────────────────────────────────────

  const std    = auditData?.standard_audit;
  const causal = auditData?.causal_audit;
  const graph  = auditData?.graph_data;
  const surf   = auditData?.impossibility_surface;

  const proxyVars = causal?.paths?.map(p => p.path[1]) ?? [];

  // Impossibility slider — pick point from frontier
  const surfPoint  = surf?.frontier_points?.[sliderIdx];
  const surfAcc    = surf?.accuracy_at_threshold?.[sliderIdx];
  const dpDisplay  = surfPoint ? fmt(surfPoint[0], 3) : "—";
  const eodDisplay = surfPoint ? fmt(surfPoint[1], 3) : "—";
  const accDisplay = surfAcc   ? `${(surfAcc * 100).toFixed(1)}%` : "—";

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="app-bg" style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active={active} onChange={setActive} />

      <main className="main-area" style={{ flex: 1, padding: "32px 40px 60px", maxWidth: "100%", minWidth: 0 }}>

        {/* Header */}
        <div className="header-flex fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, gap: 24 }}>
          <div>
            <h1 data-testid="page-title" style={{ fontSize: 34, fontWeight: 700, margin: 0, color: "#ffffff", letterSpacing: -0.6 }}>
              Causal AI Fairness Engine
            </h1>
            <p style={{ margin: "8px 0 0", color: "#8a8fa8", fontSize: 15 }}>
              Detecting hidden bias. Enabling fairer outcomes.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFileChange} />
            <button data-testid="upload-csv-btn" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <Upload size={16} />
              Upload CSV
            </button>
            <button data-testid="demo-dataset-btn" className="btn btn-primary" onClick={() => handleAudit(null)} disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : <Database size={16} />}
              {loading ? "Running Audit…" : "Use Demo Dataset"}
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 12, padding: "14px 20px", marginBottom: 20, color: "#ff8585", fontSize: 14 }}>
            ⚠ {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#8a8fa8" }}>
            <Loader2 size={40} style={{ animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
            <div style={{ fontSize: 16 }}>Running causal audit…</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>Building causal graph, computing fairness metrics</div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !auditData && !error && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#8a8fa8" }}>
            <Database size={48} style={{ margin: "0 auto 20px", opacity: 0.4 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: "#c7cae0", marginBottom: 8 }}>No audit loaded</div>
            <div style={{ fontSize: 14 }}>Click "Use Demo Dataset" to run a causal fairness audit, or upload your own CSV.</div>
          </div>
        )}

        {/* Results */}
        {!loading && auditData && (
          <>
            {/* Alert banner */}
            <div data-testid="alert-banner" className="alert-danger fade-up fade-up-d1"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div className="pulse-glow" style={{ width: 50, height: 50, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ff5d5d", flexShrink: 0 }}>
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div style={{ color: "#ffffff", fontSize: 18, fontWeight: 600 }}>
                    {causal?.verdict ?? "Audit Complete"}
                  </div>
                  <div style={{ color: "#c79ba1", fontSize: 13.5, marginTop: 4 }}>
                    {causal?.proxy_paths_found > 0
                      ? "Your model is indirectly using sensitive signals through proxy variables."
                      : "No proxy discrimination paths detected."}
                  </div>
                </div>
              </div>
              <div className="danger-badge" data-testid="affected-count">
                <div style={{ fontSize: 28, fontWeight: 700, color: "#ff7a7a", lineHeight: 1 }}>
                  {causal?.affected_candidates ?? "—"}
                </div>
                <div style={{ fontSize: 11.5, color: "#c79ba1", marginTop: 6 }}>candidates affected</div>
              </div>
            </div>

            {/* Top grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.4fr 1fr", gap: 20, marginBottom: 24 }} className="top-cards-wrap">
              <div className="top-cards" style={{ display: "contents" }}>

                {/* Standard Fairness */}
                <div className="card fair-card fade-up fade-up-d2" data-testid="standard-fairness-card">
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
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginTop: 4 }}>
                        {fmt(std?.demographic_parity_difference)}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12.5, color: "#8a8fa8", display: "flex", gap: 16 }}>
                    <span>Age DPD: <span style={{ color: "#34d399" }}>{fmt(std?.demographic_parity_difference)}</span></span>
                    <span>SES DPD: <span style={{ color: "#34d399" }}>{fmt(std?.ses_parity_difference)}</span></span>
                  </div>
                </div>

                {/* Causal Fairness */}
                <div className="card not-fair-card fade-up fade-up-d3" data-testid="causal-fairness-card">
                  <div className="card-title" style={{ marginBottom: 22 }}>Causal Fairness (DoWhy)</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                    <div className="shield-circle shield-danger">
                      <ShieldAlert size={28} />
                    </div>
                    <div>
                      <span style={{ fontSize: 22, fontWeight: 700 }} className="status-not-fair">
                        {causal?.verdict ?? "—"}
                      </span>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div className="card-subtle">Proxy Paths Found</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginTop: 4 }}>
                        {causal?.proxy_paths_found ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16, fontSize: 12.5, color: "#ff7a7a" }}>
                    {causal?.affected_candidates ?? "—"} candidates affected · Causal effect: {fmt(causal?.total_causal_effect_of_gender, 3)}
                  </div>
                </div>
              </div>

              {/* Key Insights */}
              <div className="card insights-col fade-up fade-up-d4" data-testid="key-insights-card" style={{ gridRow: "span 2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <Sparkles size={18} color="#a48bff" />
                  <div className="card-title" style={{ fontSize: 16 }}>Key Insights</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="insight-tile" data-testid="insight-paths">
                    <div className="insight-icon"><Share2 size={17} /></div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                        {causal?.proxy_paths_found ?? "—"} Proxy Bias Paths
                      </div>
                      <div style={{ fontSize: 12, color: "#8a8fa8", marginTop: 3 }}>Detected in the causal graph</div>
                    </div>
                  </div>

                  <div className="insight-tile" data-testid="insight-affected">
                    <div className="insight-icon"><Users size={17} /></div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                        {causal?.affected_candidates ?? "—"} Candidates Affected
                      </div>
                      <div style={{ fontSize: 12, color: "#8a8fa8", marginTop: 3 }}>May be unfairly impacted</div>
                    </div>
                  </div>

                  <div className="insight-tile" data-testid="insight-proxy-vars">
                    <div className="insight-icon insight-icon-pink"><Tag size={17} /></div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Top Proxy Variables</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {proxyVars.length > 0
                          ? proxyVars.map(v => <span key={v} className="chip chip-red">{v}</span>)
                          : <span style={{ color: "#8a8fa8", fontSize: 12 }}>None detected</span>}
                      </div>
                    </div>
                  </div>

                  <div className="insight-tile" data-testid="insight-recommendation">
                    <div className="insight-icon insight-icon-yellow"><Lightbulb size={17} /></div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Recommendation</div>
                      <div style={{ fontSize: 12, color: "#8a8fa8", marginTop: 3, lineHeight: 1.5 }}>
                        {causal?.proxy_paths_found > 0
                          ? "Apply surgical debiasing to remove proxy influence and improve fairness."
                          : "Model appears causally fair. Continue monitoring."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Causal Graph */}
              <div className="card fade-up fade-up-d3" data-testid="causal-graph-card" style={{ gridColumn: "span 2" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                  <div className="card-title">Causal Graph</div>
                  <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "#c7cae0", flexWrap: "wrap" }}>
                    <Legend color="#7c5cff" label="Sensitive / Group" />
                    <Legend color="#ef4444" label="Proxy" />
                    <Legend color="#10b981" label="Legitimate" />
                    <Legend color="#9aa0b9" label="Outcome" />
                  </div>
                </div>
                <div className="graph-container" style={{ height: 380 }}>
                  <CausalGraph graphData={graph} />
                </div>
              </div>
            </div>

            {/* Bottom grid */}
            <div className="bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              {/* Surgical Debiasing Impact */}
              <div className="card fade-up fade-up-d4" data-testid="debiasing-impact-card">
                <div className="card-title" style={{ marginBottom: 22 }}>Surgical Debiasing Impact</div>

                {debias ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr 1fr", gap: 18, alignItems: "center" }}>
                      {/* Before */}
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

                      {/* After */}
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

                      {/* Metrics */}
                      <div className="metric-highlight">
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#34d399" }}>
                          <BarChart3 size={16} />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>Bias Reduction</span>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: "#34d399", marginTop: 6 }}>{debias.bias_reduction_percent}%</div>
                        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, color: "#facc15", fontSize: 13, fontWeight: 500 }}>
                          Accuracy Cost
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#facc15", marginTop: 6 }}>{debias.accuracy_cost_percent}%</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ color: "#8a8fa8", fontSize: 13 }}>Removed / Down-weighted:</span>
                      {debias.variables_modified.map(v => <span key={v} className="chip chip-purple">{v}</span>)}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#8a8fa8" }}>
                    <div style={{ fontSize: 14, marginBottom: 20 }}>
                      Run debiasing to see before/after comparison
                    </div>
                    {debiasError && (
                      <div style={{ color: "#ff8585", fontSize: 13, marginBottom: 16 }}>⚠ {debiasError}</div>
                    )}
                    <button className="btn btn-primary" onClick={handleDebias} disabled={debiasLoading}>
                      {debiasLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                      {debiasLoading ? "Debiasing…" : "Run Surgical Debiasing"}
                    </button>
                  </div>
                )}
              </div>

              {/* Fairness Definition Selector / Impossibility Surface */}
              <div className="card fade-up fade-up-d5" data-testid="fairness-selector-card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div className="card-title">Fairness Definition Selector</div>
                  <HelpCircle size={15} color="#7d83a0" />
                </div>
                <div style={{ color: "#7d83a0", fontSize: 12.5, fontStyle: "italic", marginBottom: 22 }}>
                  These definitions are mathematically incompatible. (Chouldechova 2017)
                </div>

                {surf ? (
                  <>
                    {/* Threshold slider */}
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8a8fa8", marginBottom: 10 }}>
                        <span>← More Demographic Parity</span>
                        <span>More Equalized Odds →</span>
                      </div>
                      <input
                        type="range" min={0} max={16} step={1}
                        value={sliderIdx}
                        onChange={e => setSliderIdx(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "#7c5cff", cursor: "pointer", height: 6 }}
                      />
                    </div>

                    <SliderDisplay label="Demographic Parity" value={dpDisplay} pct={sliderIdx / 16} color="#7c5cff" />
                    <SliderDisplay label="Equalized Odds"     value={eodDisplay} pct={1 - sliderIdx / 16} color="#3b82f6" />
                    <SliderDisplay label="Model Accuracy"     value={accDisplay} pct={surfAcc ?? 0.85} color="#10b981" />

                    <div style={{ color: "#7d83a0", fontSize: 12.5, fontStyle: "italic", margin: "20px 0 22px", lineHeight: 1.5 }}>
                      Moving toward Equalized Odds may reduce accuracy but improves error rate parity.
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#8a8fa8", fontSize: 13, marginBottom: 22 }}>
                    Run an audit to see the impossibility surface.
                  </div>
                )}

                {/* Fairness definition picker */}
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                  {["demographic_parity", "equalized_odds"].map(def => (
                    <button
                      key={def}
                      onClick={() => setFairnessDef(def)}
                      className={`btn ${fairnessDef === def ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: 12, padding: "8px 14px" }}
                    >
                      {def === "demographic_parity" ? "Demographic Parity" : "Equalized Odds"}
                    </button>
                  ))}
                </div>

                <button data-testid="apply-fairness-btn" className="btn btn-primary" onClick={handleDebias} disabled={debiasLoading || !auditData}>
                  {debiasLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                  {debiasLoading ? "Applying…" : "Apply Selected Fairness"}
                </button>
              </div>
            </div>

            {/* Plain Language Report */}
            {auditData?.plain_language_report && (
              <div className="card fade-up" style={{ marginTop: 20 }} data-testid="report-card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <FileText size={18} color="#a48bff" />
                  <div className="card-title">Plain Language Audit Report</div>
                  {auditData.report_error && (
                    <span style={{ fontSize: 12, color: "#facc15", marginLeft: 8 }}>(fallback — Gemini unavailable)</span>
                  )}
                </div>
                <div
                  style={{ color: "#c7cae0", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", maxHeight: 400, overflowY: "auto" }}
                  dangerouslySetInnerHTML={{ __html: markdownToHtml(auditData.plain_language_report) }}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function Legend({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span className="legend-dot" style={{ background: color }} />
      {label}
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
      <div style={{ color: "#e6e8f0", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
        {value}
      </div>
    </div>
  );
}

// Minimal markdown → HTML (bold, headers, bullets only)
function markdownToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h4 style="color:#a48bff;margin:16px 0 6px;font-size:14px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="color:#e6e8f0;margin:20px 0 8px;font-size:16px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="color:#ffffff;margin:24px 0 10px;font-size:18px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#ffffff">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:8px 0">$&</ul>')
    .replace(/\n\n/g, '<br/><br/>');
}
