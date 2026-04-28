/**
 * THEMIS API client — all calls to the FastAPI backend.
 * Base URL reads from REACT_APP_API_URL env var, falls back to localhost:8000.
 */
const BASE = process.env.REACT_APP_API_URL || "https://aition.onrender.com";

/**
 * Run a full causal audit.
 * @param {File|null} file - CSV file, or null to use the demo dataset.
 * @returns {Promise<object>} AuditResponse JSON
 */
export async function runAudit(file = null) {
  const form = new FormData();
  if (file) form.append("file", file);

  const res = await fetch(`${BASE}/audit`, {
    method: "POST",
    body: file ? form : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Audit failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Run surgical debiasing on a completed audit.
 * @param {string} auditId
 * @param {string} fairnessDefinition - "demographic_parity" | "equalized_odds"
 * @returns {Promise<object>} DebiasingResult JSON
 */
export async function runDebias(auditId, fairnessDefinition = "equalized_odds") {
  const res = await fetch(`${BASE}/audit/${auditId}/debias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selected_fairness_definition: fairnessDefinition,
      accept_accuracy_cost_max_percent: 10.0,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Debiasing failed: ${res.status}`);
  }
  return res.json();
}
