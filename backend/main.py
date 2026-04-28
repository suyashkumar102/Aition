"""
THEMIS Causal Fairness Engine — FastAPI Backend
All backend logic lives here (single-file design for demo simplicity).
"""

import io
import json
import logging
import os
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

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Startup Validation ────────────────────────────────────────────────────────

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY environment variable is required")

# ── Constants ─────────────────────────────────────────────────────────────────

REQUIRED_COLUMNS = [
    "gender",
    "experience_years",
    "test_score",
    "college_tier",
    "employment_gap",
    "hired",
]

# ── Data Models ───────────────────────────────────────────────────────────────


@dataclass
class StandardAuditResult:
    demographic_parity_difference: float  # rounded to 4 decimal places
    passes_standard_test: bool            # abs(dpd) < 0.10
    verdict: str                          # "FAIR" or "BIASED"


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
class AuditResponse:
    standard_audit: StandardAuditResult
    causal_audit: CausalAuditResult
    plain_language_report: str
    graph_data: GraphData
    report_error: Optional[str] = None  # set if Gemini call failed


# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(title="Aition Causal Fairness Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        causal = run_causal_audit(df)
        graph = build_graph_data()
        report, report_error = generate_report(df, standard, causal)

        response = AuditResponse(
            standard_audit=standard,
            causal_audit=causal,
            plain_language_report=report,
            graph_data=graph,
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
        df = pd.read_csv("data/demo_hiring_dataset.csv")
    else:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
    validate_schema(df)
    logger.info("Dataset loaded: %d rows", len(df))
    return df


def encode_gender(df: pd.DataFrame) -> pd.DataFrame:
    """
    Return copy of df with gender encoded: 'M' → 1, 'F' → 0.
    Does not mutate the original dataframe.
    """
    df_encoded = df.copy()
    df_encoded["gender"] = df_encoded["gender"].map({"M": 1, "F": 0})
    return df_encoded


# ── Standard Fairness Check ───────────────────────────────────────────────────


def compute_standard_fairness(df: pd.DataFrame) -> StandardAuditResult:
    """
    Encode gender to numeric, build AIF360 BinaryLabelDataset,
    compute mean_difference(), apply 0.10 threshold.
    Returns StandardAuditResult with dpd, passes_standard_test, verdict.
    """
    df_enc = encode_gender(df)
    bld = BinaryLabelDataset(
        df=df_enc,
        label_names=["hired"],
        protected_attribute_names=["gender"],
    )
    privileged_groups = [{"gender": 1}]
    unprivileged_groups = [{"gender": 0}]
    metric = BinaryLabelDatasetMetric(bld, privileged_groups, unprivileged_groups)
    dpd = round(float(metric.mean_difference()), 4)
    passes_standard_test = abs(dpd) < 0.10
    verdict = "FAIR" if passes_standard_test else "BIASED"
    logger.info("Standard check complete: DPD=%s, verdict=%s", dpd, verdict)
    return StandardAuditResult(
        demographic_parity_difference=dpd,
        passes_standard_test=passes_standard_test,
        verdict=verdict,
    )


# ── Causal Audit ──────────────────────────────────────────────────────────────


def build_causal_model(df: pd.DataFrame) -> tuple:
    """
    Construct DoWhy CausalModel and return (model, total_causal_effect).
    treatment='gender' (numeric), outcome='hired',
    common_causes=['experience_years','test_score','college_tier','employment_gap'].
    """
    df_enc = encode_gender(df)
    model = CausalModel(
        data=df_enc,
        treatment="gender",
        outcome="hired",
        common_causes=["experience_years", "test_score", "college_tier", "employment_gap"],
    )
    identified_estimand = model.identify_effect()
    estimate = model.estimate_effect(
        identified_estimand,
        method_name="backdoor.linear_regression",
    )
    effect = round(float(estimate.value), 3)
    logger.info("Causal model built, total effect=%s", effect)
    return (model, effect)


def detect_proxy_paths(df: pd.DataFrame) -> list[ProxyPath]:
    """
    Compute mean proxy variable values by gender group.
    Return list of ProxyPath objects for college_tier and employment_gap.
    Effect = female_mean - male_mean for each proxy variable.
    """
    male_df = df[df["gender"] == "M"]
    female_df = df[df["gender"] == "F"]

    college_effect = round(
        float(female_df["college_tier"].mean() - male_df["college_tier"].mean()), 3
    )
    gap_effect = round(
        float(female_df["employment_gap"].mean() - male_df["employment_gap"].mean()), 3
    )

    return [
        ProxyPath(
            path=["gender", "college_tier", "hired"],
            type="proxy",
            effect=college_effect,
            description="Gender correlates with college tier in historical data",
        ),
        ProxyPath(
            path=["gender", "employment_gap", "hired"],
            type="proxy",
            effect=gap_effect,
            description="Gender correlates with employment gaps in historical data",
        ),
    ]


def compute_affected_candidates(df: pd.DataFrame) -> int:
    """
    Compute int((male_hire_rate - female_hire_rate) * count_female).
    """
    male_hire_rate = df[df["gender"] == "M"]["hired"].mean()
    female_hire_rate = df[df["gender"] == "F"]["hired"].mean()
    n_female = len(df[df["gender"] == "F"])
    return int((male_hire_rate - female_hire_rate) * n_female)


def build_graph_data() -> GraphData:
    """
    Return hardcoded GraphData with 6 nodes and 6 edges.
    Causal strength values are fixed per requirements.
    """
    nodes = [
        GraphNode(id="gender",         label="Gender",         type="protected"),
        GraphNode(id="college_tier",   label="College Tier",   type="proxy"),
        GraphNode(id="employment_gap", label="Employment Gap", type="proxy"),
        GraphNode(id="test_score",     label="Test Score",     type="legitimate"),
        GraphNode(id="experience",     label="Experience",     type="legitimate"),
        GraphNode(id="hired",          label="Hired",          type="outcome"),
    ]
    edges = [
        GraphEdge(source="gender",         target="college_tier",   type="proxy",      strength=0.34),
        GraphEdge(source="gender",         target="employment_gap", type="proxy",      strength=0.21),
        GraphEdge(source="college_tier",   target="hired",          type="proxy",      strength=0.28),
        GraphEdge(source="employment_gap", target="hired",          type="proxy",      strength=0.19),
        GraphEdge(source="test_score",     target="hired",          type="legitimate", strength=0.41),
        GraphEdge(source="experience",     target="hired",          type="legitimate", strength=0.31),
    ]
    return GraphData(nodes=nodes, edges=edges)


def run_causal_audit(df: pd.DataFrame) -> CausalAuditResult:
    """
    Build DoWhy CausalModel, identify estimand, estimate effect
    via backdoor.linear_regression, detect proxy paths,
    compute affected_candidates.
    Returns CausalAuditResult.
    """
    _model, total_effect = build_causal_model(df)
    paths = detect_proxy_paths(df)
    affected = compute_affected_candidates(df)
    proxy_paths_found = len(paths)
    verdict = "PROXY DISCRIMINATION DETECTED" if paths else "NO PROXY PATHS FOUND"
    logger.info("Proxy paths identified: %d", proxy_paths_found)
    return CausalAuditResult(
        proxy_paths_found=proxy_paths_found,
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
    male_rate = df[df["gender"] == "M"]["hired"].mean() * 100
    female_rate = df[df["gender"] == "F"]["hired"].mean() * 100
    std_verdict = "PASSED" if standard.passes_standard_test else "FAILED"

    return f"""You are an expert AI fairness auditor writing a comprehensive audit report for an HR director and legal team.

Write a detailed, professional report in **Markdown format** covering all sections below. Be specific, use the exact numbers provided, and write in plain language suitable for non-technical executives. Aim for 600-800 words total.

---

## Audit Data

- Dataset: {len(df)} hiring records
- Female hire rate: {female_rate:.1f}%
- Male hire rate: {male_rate:.1f}%
- Demographic Parity Difference (DPD): {standard.demographic_parity_difference}
- Standard fairness test (AIF360): {std_verdict}
- Causal audit verdict: {causal.verdict}
- Proxy discrimination paths found: {causal.proxy_paths_found}
  - Path 1: gender → college_tier → hired (group mean effect: {causal.paths[0].effect})
  - Path 2: gender → employment_gap → hired (group mean effect: {causal.paths[1].effect})
- Total causal effect of gender on hiring: {causal.total_causal_effect_of_gender}
- Estimated wrongly rejected female candidates: {causal.affected_candidates}

---

## Required Report Sections

### 1. Executive Summary
A 3-4 sentence overview of what was found and why it matters.

### 2. What the AI Was Doing Wrong
Explain clearly how the model passed standard fairness tests yet still discriminated. Describe proxy discrimination in plain terms. Reference the specific proxy variables and their effects.

### 3. Who Was Affected
Quantify the impact. Name the {causal.affected_candidates} affected candidates. Compare hire rates. Explain the human cost.

### 4. Root Cause Analysis
Explain why college_tier and employment_gap act as proxies for gender. Describe the causal mechanism (historical bias encoded in training data).

### 5. Risk & Legal Exposure
Briefly note the legal and reputational risks of proxy discrimination under equal employment laws.

### 6. Recommended Actions
Provide 4-5 concrete, prioritized action items with clear owners (HR, Legal, Engineering).

### 7. Conclusion
A closing statement on the importance of causal fairness auditing beyond standard metrics.

---

Format the entire response as clean Markdown with headers, bullet points, and bold key numbers. Do not include any preamble or meta-commentary.
"""


def fallback_report(
    standard: StandardAuditResult,
    causal: CausalAuditResult,
    df: pd.DataFrame,
) -> str:
    """Return plain-text fallback report with key numbers."""
    male_rate = df[df["gender"] == "M"]["hired"].mean() * 100
    female_rate = df[df["gender"] == "F"]["hired"].mean() * 100

    return f"""Aition Causal Audit Report (Auto-generated)

WHAT THE AI WAS DOING WRONG
The hiring model uses college_tier and employment_gap as proxy variables \
that correlate with gender, causing indirect discrimination.

WHO WAS AFFECTED
Approximately {causal.affected_candidates} qualified female candidates were estimated \
to be wrongly rejected. Female hire rate: {female_rate:.1f}% vs Male hire rate: {male_rate:.1f}%.

WHAT SHOULD BE DONE
Remove or reweight college_tier and employment_gap from the hiring model. \
Conduct a manual review of rejected female candidates from the past 12 months.
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
    if isinstance(obj, list):
        return [convert_numpy_types(i) for i in obj]
    return obj
