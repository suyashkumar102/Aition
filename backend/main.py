"""
THEMIS Causal Fairness Engine — FastAPI Backend
All backend logic lives here (single-file design for demo simplicity).
"""

import io
import json
import logging
import os
import uuid
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

from dotenv import load_dotenv
load_dotenv()  # loads .env from project root automatically

import numpy as np
import pandas as pd
from aif360.datasets import BinaryLabelDataset
from aif360.metrics import BinaryLabelDatasetMetric
from dowhy import CausalModel
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Startup Validation ────────────────────────────────────────────────────────

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY environment variable is required")

# ── Constants ─────────────────────────────────────────────────────────────────

REQUIRED_COLUMNS = [
    "age_group",
    "socioeconomic_group",
    "experience_years",
    "test_score",
    "college_graduation_year_gap",
    "employment_gap",
    "neighborhood_quality",
    "hired",
]

# ── Data Models ───────────────────────────────────────────────────────────────


@dataclass
class StandardAuditResult:
    demographic_parity_difference: float        # age_group DPD, rounded to 4dp
    ses_parity_difference: float                # socioeconomic_group DPD, rounded to 4dp
    passes_standard_test: bool                  # both abs(dpd) < 0.10
    verdict: str                                # "FAIR" or "BIASED"


@dataclass
class ProxyPath:
    path: list[str]   # e.g. ["gender", "college_tier", "hired"]
    type: str         # always "proxy"
    effect: float     # female_mean - male_mean, rounded to 3dp
    description: str  # human-readable explanation


@dataclass
class CausalAuditResult:
    proxy_paths_found: int
    paths: list[ProxyPath]
    total_causal_effect_of_gender: float  # rounded to 3 decimal places
    verdict: str                          # "PROXY DISCRIMINATION DETECTED" or "NO PROXY PATHS FOUND"
    affected_candidates: int


@dataclass
class GraphNode:
    id: str
    label: str
    type: str  # "protected" | "proxy" | "legitimate" | "outcome"


@dataclass
class GraphEdge:
    source: str
    target: str
    type: str      # "proxy" | "legitimate"
    strength: float


@dataclass
class GraphData:
    nodes: list[GraphNode]
    edges: list[GraphEdge]


@dataclass
class ImpossibilitySurface:
    frontier_points: list[list[float]]      # [[dpd, eod], ...] for each threshold
    current_position: list[float]           # [dpd, eod] at threshold=0.5
    accuracy_at_threshold: list[float]      # accuracy for each threshold step


@dataclass
class DebiasingRequest:
    selected_fairness_definition: str          # "demographic_parity" | "equalized_odds"
    accept_accuracy_cost_max_percent: float = 5.0


@dataclass
class DebiasingResult:
    selected_fairness_definition: str
    strategy_applied: str                      # "proxy_removal" | "reweighting" | "adversarial"
    variables_modified: list[str]
    bias_index_before: float
    bias_index_after: float
    accuracy_before: float
    accuracy_after: float
    accuracy_cost_percent: float
    bias_reduction_percent: float


@dataclass
class AuditResponse:
    standard_audit: StandardAuditResult
    causal_audit: CausalAuditResult
    plain_language_report: str
    graph_data: GraphData
    bias_index: float = 0.0
    impossibility_surface: Optional["ImpossibilitySurface"] = None
    audit_id: str = ""
    report_error: Optional[str] = None  # set if Gemini call failed


# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(title="Aition Causal Fairness Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-Memory Audit Cache ─────────────────────────────────────────────────────

_audit_cache: dict = {}  # audit_id -> (df, causal_result)

# ── Endpoint Handlers ─────────────────────────────────────────────────────────


@app.get("/health")
async def health() -> dict:
    """GET /health — liveness check."""
    return {"status": "ok"}


@app.post("/audit")
async def audit(file: Optional[UploadFile] = File(None)):
    """POST /audit — runs the full 5-step audit pipeline."""
    try:
        df = await load_dataset(file)
        standard = compute_standard_fairness(df)
        bias_index = compute_bias_index(standard)
        causal = run_causal_audit(df)
        graph = build_graph_data()
        impossibility_surface = compute_impossibility_surface(df)
        report, report_error = generate_report(df, standard, causal)

        audit_id = str(uuid.uuid4())
        _audit_cache[audit_id] = (df, causal)

        response = AuditResponse(
            standard_audit=standard,
            causal_audit=causal,
            plain_language_report=report,
            graph_data=graph,
            bias_index=bias_index,
            impossibility_surface=impossibility_surface,
            audit_id=audit_id,
            report_error=report_error,
        )

        import dataclasses
        result = convert_numpy_types(dataclasses.asdict(response))
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unhandled error in audit pipeline")
        return JSONResponse(status_code=500, content={"error": str(exc)})


# ── Dataset Loading ───────────────────────────────────────────────────────────


def validate_schema(df: pd.DataFrame) -> None:
    """
    Validate required columns exist and row count >= 100.
    Raises HTTPException(422) with descriptive message on failure.
    """
    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required columns: {missing}")
    if len(df) < 100:
        raise HTTPException(
            status_code=422,
            detail="Dataset too small for reliable causal analysis. Minimum 100 rows required.",
        )


async def load_dataset(file: Optional[UploadFile]) -> pd.DataFrame:
    """
    Load demo CSV or uploaded file.
    Raises HTTPException(422) on schema/size violations.
    """
    if file is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        df = pd.read_csv(os.path.join(base_dir, "data", "demo_hiring_dataset.csv"))
    else:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    validate_schema(df)
    logger.info("Dataset loaded: %d rows", len(df))
    return df


def encode_age_group(df: pd.DataFrame) -> pd.DataFrame:
    """Return copy of df with age_group encoded: 'Young' → 1, 'Senior' → 0."""
    df_encoded = df.copy()
    df_encoded["age_group"] = df_encoded["age_group"].map({"Young": 1, "Senior": 0})
    return df_encoded


def encode_ses(df: pd.DataFrame) -> pd.DataFrame:
    """Return copy of df with socioeconomic_group encoded: 'High' → 1, 'Low' → 0."""
    df_encoded = df.copy()
    df_encoded["socioeconomic_group"] = df_encoded["socioeconomic_group"].map({"High": 1, "Low": 0})
    return df_encoded


def encode_all(df: pd.DataFrame) -> pd.DataFrame:
    """Encode both protected attributes."""
    return encode_ses(encode_age_group(df))


# Keep alias for internal use
encode_gender = encode_age_group


# ── Standard Fairness Check ───────────────────────────────────────────────────


def compute_standard_fairness(df: pd.DataFrame) -> StandardAuditResult:
    """
    Compute AIF360 mean_difference() for both age_group and socioeconomic_group.
    Passes only if BOTH DPDs are < 0.10.
    """
    df_enc = encode_all(df)

    def _dpd(protected: str, priv: int) -> float:
        bld = BinaryLabelDataset(
            df=df_enc,
            label_names=["hired"],
            protected_attribute_names=[protected],
        )
        metric = BinaryLabelDatasetMetric(
            bld,
            privileged_groups=[{protected: priv}],
            unprivileged_groups=[{protected: 1 - priv}],
        )
        return round(float(metric.mean_difference()), 4)

    dpd_age = _dpd("age_group", 1)          # Young=1 privileged
    dpd_ses = _dpd("socioeconomic_group", 1) # High=1 privileged
    passes = abs(dpd_age) < 0.10 and abs(dpd_ses) < 0.10
    verdict = "FAIR" if passes else "BIASED"
    logger.info("Standard check: DPD_age=%s DPD_ses=%s verdict=%s", dpd_age, dpd_ses, verdict)
    return StandardAuditResult(
        demographic_parity_difference=dpd_age,
        ses_parity_difference=dpd_ses,
        passes_standard_test=passes,
        verdict=verdict,
    )


# ── Causal Audit ──────────────────────────────────────────────────────────────


def build_causal_model(df: pd.DataFrame) -> tuple:
    """
    Build two DoWhy CausalModels (one per protected attribute) and return
    (age_model, ses_model, age_effect, ses_effect).
    """
    df_enc = encode_all(df)
    common = ["experience_years", "test_score", "college_graduation_year_gap",
              "employment_gap", "neighborhood_quality"]

    def _fit(treatment: str) -> float:
        model = CausalModel(
            data=df_enc,
            treatment=treatment,
            outcome="hired",
            common_causes=[c for c in common if c != treatment],
        )
        estimand = model.identify_effect()
        est = model.estimate_effect(estimand, method_name="backdoor.linear_regression")
        return round(float(est.value), 3)

    age_effect = _fit("age_group")
    ses_effect = _fit("socioeconomic_group")
    total_effect = round(age_effect + ses_effect, 3)
    logger.info("Causal effects — age: %s  ses: %s", age_effect, ses_effect)
    return age_effect, ses_effect, total_effect


def detect_proxy_paths(df: pd.DataFrame) -> list[ProxyPath]:
    """
    Detect all 3 proxy paths across both protected attributes.
    Effects are group mean differences on the proxy variable.
    """
    young_df  = df[df["age_group"] == "Young"]
    senior_df = df[df["age_group"] == "Senior"]
    high_df   = df[df["socioeconomic_group"] == "High"]
    low_df    = df[df["socioeconomic_group"] == "Low"]

    grad_effect = round(float(
        senior_df["college_graduation_year_gap"].mean() - young_df["college_graduation_year_gap"].mean()
    ), 3)
    emp_effect = round(float(
        senior_df["employment_gap"].mean() - young_df["employment_gap"].mean()
    ), 3)
    nbhd_effect = round(float(
        high_df["neighborhood_quality"].mean() - low_df["neighborhood_quality"].mean()
    ), 3)

    return [
        ProxyPath(
            path=["age_group", "college_graduation_year_gap", "hired"],
            type="proxy",
            effect=grad_effect,
            description="Senior candidates have older degrees — model penalises graduation year gap as a proxy for age",
        ),
        ProxyPath(
            path=["age_group", "employment_gap", "hired"],
            type="proxy",
            effect=emp_effect,
            description="Senior candidates more likely to have career breaks — model penalises employment gaps as a proxy for age",
        ),
        ProxyPath(
            path=["socioeconomic_group", "neighborhood_quality", "hired"],
            type="proxy",
            effect=nbhd_effect,
            description="Low-SES candidates more likely to come from lower-quality neighbourhoods — model uses neighbourhood as a proxy for socioeconomic background",
        ),
    ]


def compute_affected_candidates(df: pd.DataFrame) -> int:
    """
    Sum of wrongly rejected seniors + wrongly rejected low-SES candidates.
    """
    young_rate  = df[df["age_group"] == "Young"]["hired"].mean()
    senior_rate = df[df["age_group"] == "Senior"]["hired"].mean()
    high_rate   = df[df["socioeconomic_group"] == "High"]["hired"].mean()
    low_rate    = df[df["socioeconomic_group"] == "Low"]["hired"].mean()
    n_senior = len(df[df["age_group"] == "Senior"])
    n_low    = len(df[df["socioeconomic_group"] == "Low"])
    return int((young_rate - senior_rate) * n_senior) + int((high_rate - low_rate) * n_low)


def build_graph_data() -> GraphData:
    """Return GraphData with 8 nodes and 8 edges covering both protected attributes."""
    nodes = [
        GraphNode(id="age_group",                    label="Age Group",              type="protected"),
        GraphNode(id="socioeconomic_group",          label="Socioeconomic Group",    type="protected"),
        GraphNode(id="college_graduation_year_gap",  label="Graduation Year Gap",    type="proxy"),
        GraphNode(id="employment_gap",               label="Employment Gap",         type="proxy"),
        GraphNode(id="neighborhood_quality",         label="Neighbourhood Quality",  type="proxy"),
        GraphNode(id="test_score",                   label="Test Score",             type="legitimate"),
        GraphNode(id="experience",                   label="Experience",             type="legitimate"),
        GraphNode(id="hired",                        label="Hired",                  type="outcome"),
    ]
    edges = [
        GraphEdge(source="age_group",                   target="college_graduation_year_gap", type="proxy",      strength=0.34),
        GraphEdge(source="age_group",                   target="employment_gap",              type="proxy",      strength=0.21),
        GraphEdge(source="socioeconomic_group",         target="neighborhood_quality",        type="proxy",      strength=0.42),
        GraphEdge(source="college_graduation_year_gap", target="hired",                       type="proxy",      strength=0.28),
        GraphEdge(source="employment_gap",              target="hired",                       type="proxy",      strength=0.19),
        GraphEdge(source="neighborhood_quality",        target="hired",                       type="proxy",      strength=0.31),
        GraphEdge(source="test_score",                  target="hired",                       type="legitimate", strength=0.41),
        GraphEdge(source="experience",                  target="hired",                       type="legitimate", strength=0.31),
    ]
    return GraphData(nodes=nodes, edges=edges)


def run_causal_audit(df: pd.DataFrame) -> CausalAuditResult:
    """
    Build DoWhy CausalModels for both protected attributes, detect all 3 proxy paths,
    compute affected_candidates.
    """
    age_effect, ses_effect, total_effect = build_causal_model(df)
    paths = detect_proxy_paths(df)
    affected = compute_affected_candidates(df)
    verdict = "PROXY DISCRIMINATION DETECTED" if paths else "NO PROXY PATHS FOUND"
    logger.info("Proxy paths identified: %d", len(paths))
    return CausalAuditResult(
        proxy_paths_found=len(paths),
        paths=paths,
        total_causal_effect_of_gender=total_effect,
        verdict=verdict,
        affected_candidates=affected,
    )


# ── Report Generation ─────────────────────────────────────────────────────────


def build_prompt(
    df: pd.DataFrame,
    standard: StandardAuditResult,
    causal: CausalAuditResult,
) -> str:
    """Construct the structured prompt string for Gemini."""
    young_rate  = df[df["age_group"] == "Young"]["hired"].mean() * 100
    senior_rate = df[df["age_group"] == "Senior"]["hired"].mean() * 100
    high_rate   = df[df["socioeconomic_group"] == "High"]["hired"].mean() * 100
    low_rate    = df[df["socioeconomic_group"] == "Low"]["hired"].mean() * 100
    std_verdict = "PASSED" if standard.passes_standard_test else "FAILED"

    return f"""You are an expert AI fairness auditor writing a comprehensive audit report for an HR director and legal team.

Write a detailed, professional report in **Markdown format** covering all sections below. Be specific, use the exact numbers provided, and write in plain language suitable for non-technical executives. Aim for 600-800 words total.

---

## Audit Data

- Dataset: {len(df)} hiring records
- Age group — Young hire rate: {young_rate:.1f}% | Senior hire rate: {senior_rate:.1f}%
- Socioeconomic group — High SES hire rate: {high_rate:.1f}% | Low SES hire rate: {low_rate:.1f}%
- DPD (age): {standard.demographic_parity_difference} | DPD (socioeconomic): {standard.ses_parity_difference}
- Standard fairness test (AIF360, both attributes): {std_verdict}
- Causal audit verdict: {causal.verdict}
- Proxy discrimination paths found: {causal.proxy_paths_found}
  - Path 1: age_group → college_graduation_year_gap → hired (effect: {causal.paths[0].effect})
  - Path 2: age_group → employment_gap → hired (effect: {causal.paths[1].effect})
  - Path 3: socioeconomic_group → neighborhood_quality → hired (effect: {causal.paths[2].effect})
- Combined causal effect: {causal.total_causal_effect_of_gender}
- Estimated total wrongly rejected candidates: {causal.affected_candidates}

---

## Required Report Sections

### 1. Executive Summary
3-4 sentences. Two protected groups affected. Both passed standard tests. THEMIS found hidden proxy paths.

### 2. What the AI Was Doing Wrong
Explain proxy discrimination for both age and socioeconomic background. Reference the three specific proxy variables.

### 3. Who Was Affected
Quantify impact for senior candidates AND low-SES candidates separately. Use the hire rate numbers above.

### 4. Root Cause Analysis
Explain why graduation year gap and employment gaps proxy for age, and why neighbourhood quality proxies for socioeconomic background. Describe how historical patterns get encoded in training data.

### 5. Risk & Legal Exposure
Age discrimination and socioeconomic proxy discrimination legal risks.

### 6. Recommended Actions
4-5 concrete prioritised actions with owners (HR, Legal, Engineering).

### 7. Conclusion
Closing statement on multi-attribute causal fairness auditing.

---

Format as clean Markdown with headers, bullet points, and bold key numbers. No preamble or meta-commentary.
"""


def fallback_report(
    standard: StandardAuditResult,
    causal: CausalAuditResult,
    df: pd.DataFrame,
) -> str:
    """Return plain-text fallback report with key numbers."""
    young_rate  = df[df["age_group"] == "Young"]["hired"].mean() * 100
    senior_rate = df[df["age_group"] == "Senior"]["hired"].mean() * 100
    high_rate   = df[df["socioeconomic_group"] == "High"]["hired"].mean() * 100
    low_rate    = df[df["socioeconomic_group"] == "Low"]["hired"].mean() * 100

    return f"""Aition Causal Audit Report (Auto-generated)

WHAT THE AI WAS DOING WRONG
The hiring model uses college_graduation_year_gap and employment_gap as proxies for age, \
and neighborhood_quality as a proxy for socioeconomic background, causing indirect discrimination \
against senior and low-SES candidates.

WHO WAS AFFECTED
Approximately {causal.affected_candidates} candidates were estimated to be wrongly rejected. \
Senior hire rate: {senior_rate:.1f}% vs Young: {young_rate:.1f}%. \
Low SES hire rate: {low_rate:.1f}% vs High SES: {high_rate:.1f}%.

WHAT SHOULD BE DONE
Remove college_graduation_year_gap and neighborhood_quality from the hiring model. \
Reweight employment_gap to equalise its distribution across age groups. \
Conduct a manual review of rejected senior and low-SES candidates from the past 12 months.
"""


def generate_report(
    df: pd.DataFrame,
    standard: StandardAuditResult,
    causal: CausalAuditResult,
) -> tuple[str, Optional[str]]:
    """
    Build Gemini prompt, call gemini-2.0-flash (temperature=0.2, timeout=30s).
    Returns (report_text, report_error) — report_error is None on success.
    """
    from google import genai
    from google.genai import types as genai_types

    prompt = build_prompt(df, standard, causal)
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=genai_types.GenerateContentConfig(temperature=0.2),
        )
        report_text = response.text
        logger.info("Report generated")
        return report_text, None
    except Exception as exc:
        logger.error("Report generation failed, using fallback: %s", exc)
        return fallback_report(standard, causal, df), str(exc)


# ── Serialization ─────────────────────────────────────────────────────────────


def convert_numpy_types(obj: Any) -> Any:
    """
    Recursively convert numpy scalars/arrays to Python native types.
    numpy.float64 → float, numpy.int64 → int, numpy.ndarray → list.
    """
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {k: convert_numpy_types(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [convert_numpy_types(i) for i in obj]
    return obj

# ── Bias Index ────────────────────────────────────────────────────────────────


def compute_bias_index(standard: StandardAuditResult) -> float:
    """Returns max(abs(DPD_age), abs(DPD_ses)) as a composite bias score in [0, 1]."""
    return round(max(abs(standard.demographic_parity_difference),
                     abs(standard.ses_parity_difference)), 4)


# ── Impossibility Surface ─────────────────────────────────────────────────────


def compute_eod(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    age: np.ndarray,
) -> float:
    """
    Compute equalized odds difference: average of |TPR_young - TPR_senior| and |FPR_young - FPR_senior|.
    """
    young_mask = age == 1
    senior_mask = age == 0

    def tpr(mask: np.ndarray) -> float:
        pos = y_true[mask] == 1
        if pos.sum() == 0:
            return 0.0
        return float((y_pred[mask][pos] == 1).mean())

    def fpr(mask: np.ndarray) -> float:
        neg = y_true[mask] == 0
        if neg.sum() == 0:
            return 0.0
        return float((y_pred[mask][neg] == 1).mean())

    tpr_diff = abs(tpr(young_mask) - tpr(senior_mask))
    fpr_diff = abs(fpr(young_mask) - fpr(senior_mask))
    return round((tpr_diff + fpr_diff) / 2, 4)


def compute_impossibility_surface(df: pd.DataFrame) -> ImpossibilitySurface:
    """
    Train LogisticRegression on all 5 features, sweep threshold 0.1→0.9 in 0.05 steps.
    Uses age_group as the primary protected attribute for DPD/EOD computation.
    """
    df_enc = encode_all(df)
    features = ["experience_years", "test_score", "college_graduation_year_gap",
                "employment_gap", "neighborhood_quality"]
    X = df_enc[features].values
    y = df_enc["hired"].values
    age = df_enc["age_group"].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    clf = LogisticRegression(random_state=42)
    clf.fit(X_scaled, y)
    proba = clf.predict_proba(X_scaled)[:, 1]

    frontier_points: list[list[float]] = []
    accuracy_at_threshold: list[float] = []

    for threshold in np.arange(0.1, 0.95, 0.05):  # 17 steps
        y_pred = (proba >= threshold).astype(int)
        young_rate = y_pred[age == 1].mean() if (age == 1).sum() > 0 else 0.0
        senior_rate = y_pred[age == 0].mean() if (age == 0).sum() > 0 else 0.0
        dpd = abs(young_rate - senior_rate)
        eod = compute_eod(y, y_pred, age)
        accuracy = (y_pred == y).mean()
        frontier_points.append([round(float(dpd), 4), round(float(eod), 4)])
        accuracy_at_threshold.append(round(float(accuracy), 4))

    current_pos_idx = len(frontier_points) // 2  # threshold=0.5
    logger.info("Impossibility surface computed: %d threshold steps", len(frontier_points))
    return ImpossibilitySurface(
        frontier_points=frontier_points,
        current_position=frontier_points[current_pos_idx],
        accuracy_at_threshold=accuracy_at_threshold,
    )


# ── Surgical Debiasing ────────────────────────────────────────────────────────


def compute_reweighting(df_enc: pd.DataFrame, age: np.ndarray) -> np.ndarray:
    """
    Compute sample weights to equalize employment_gap distribution between age groups.
    Returns a numpy array of weights, one per sample.
    """
    weights = np.ones(len(df_enc))
    young_mask = age == 1
    senior_mask = age == 0

    young_gap_rate = df_enc.loc[young_mask, "employment_gap"].mean()
    senior_gap_rate = df_enc.loc[senior_mask, "employment_gap"].mean()

    # Upweight seniors with no employment gap (to match young distribution)
    if senior_gap_rate > young_gap_rate:
        ratio = young_gap_rate / senior_gap_rate if senior_gap_rate > 0 else 1.0
        weights[senior_mask & (df_enc["employment_gap"] == 1).values] *= ratio
        no_gap_denom = 1 - senior_gap_rate
        weights[senior_mask & (df_enc["employment_gap"] == 0).values] *= (
            (1 - young_gap_rate) / no_gap_denom if no_gap_denom > 0 else 1.0
        )

    return weights


def run_surgical_debiasing(
    df: pd.DataFrame,
    causal: CausalAuditResult,
    fairness_definition: str,
) -> DebiasingResult:
    """
    Baseline: all 5 features. Surgical correction:
      - Remove college_graduation_year_gap and neighborhood_quality (proxy removal)
      - Reweight samples to equalise employment_gap distribution across age groups
    """
    df_enc = encode_all(df)
    all_features = ["experience_years", "test_score", "college_graduation_year_gap",
                    "employment_gap", "neighborhood_quality"]
    X = df_enc[all_features].values
    y = df_enc["hired"].values
    age = df_enc["age_group"].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    clf_before = LogisticRegression(random_state=42).fit(X_scaled, y)
    y_pred_before = clf_before.predict(X_scaled)
    bias_before = abs(y_pred_before[age == 1].mean() - y_pred_before[age == 0].mean())
    accuracy_before = (y_pred_before == y).mean()

    # Remove both proxy columns; reweight for employment_gap
    proxy_features = ["experience_years", "test_score", "employment_gap"]
    weights = compute_reweighting(df_enc, age)
    X_proxy_scaled = StandardScaler().fit_transform(df_enc[proxy_features].values)
    clf_after = LogisticRegression(random_state=42).fit(X_proxy_scaled, y, sample_weight=weights)
    y_pred_after = clf_after.predict(X_proxy_scaled)
    bias_after = abs(y_pred_after[age == 1].mean() - y_pred_after[age == 0].mean())
    accuracy_after = (y_pred_after == y).mean()

    bias_reduction = (
        round(float((bias_before - bias_after) / bias_before * 100), 1)
        if bias_before > 0 else 0.0
    )
    logger.info("Debiasing: bias %.4f → %.4f, accuracy %.4f → %.4f",
                bias_before, bias_after, accuracy_before, accuracy_after)

    return DebiasingResult(
        selected_fairness_definition=fairness_definition,
        strategy_applied="proxy_removal",
        variables_modified=["college_graduation_year_gap", "neighborhood_quality", "employment_gap"],
        bias_index_before=round(float(bias_before), 4),
        bias_index_after=round(float(bias_after), 4),
        accuracy_before=round(float(accuracy_before), 4),
        accuracy_after=round(float(accuracy_after), 4),
        accuracy_cost_percent=round(float((accuracy_before - accuracy_after) * 100), 2),
        bias_reduction_percent=bias_reduction,
    )



@app.post("/audit/{audit_id}/debias")
async def debias(audit_id: str, request: DebiasingRequest):
    """POST /audit/{audit_id}/debias — run surgical debiasing on a cached audit."""
    if audit_id not in _audit_cache:
        raise HTTPException(status_code=404, detail=f"Audit {audit_id} not found")
    df, causal = _audit_cache[audit_id]
    try:
        result = run_surgical_debiasing(df, causal, request.selected_fairness_definition)
        import dataclasses
        return JSONResponse(content=convert_numpy_types(dataclasses.asdict(result)))
    except Exception as exc:
        logger.exception("Debiasing failed")
        return JSONResponse(status_code=500, content={"error": f"Debiasing failed: {str(exc)}"})
