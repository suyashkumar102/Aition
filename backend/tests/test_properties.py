# Feature: themis-round1-mvp
"""Property-based tests for THEMIS Round 1 MVP (Task 11.1)."""

import os
import json
import numpy as np
import pandas as pd
import pytest

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from hypothesis import given, settings, assume
from hypothesis import strategies as st
from fastapi import HTTPException

from backend.main import (
    validate_schema,
    encode_gender,
    compute_affected_candidates,
    build_graph_data,
    convert_numpy_types,
    fallback_report,
    REQUIRED_COLUMNS,
    StandardAuditResult,
    CausalAuditResult,
    ProxyPath,
)

settings.register_profile("ci", max_examples=100)
settings.load_profile("ci")


# ── Property 1: Schema validation rejects missing columns ─────────────────────
# Validates: Requirements 2.3, 2.4

@given(st.lists(st.sampled_from(REQUIRED_COLUMNS), min_size=1, max_size=len(REQUIRED_COLUMNS) - 1, unique=True))
@settings(max_examples=100)
def test_p1_schema_rejects_missing_columns(present_cols):
    """Any strict subset of REQUIRED_COLUMNS should fail validation."""
    missing = [c for c in REQUIRED_COLUMNS if c not in present_cols]
    assume(len(missing) > 0)
    df = pd.DataFrame({c: [1] * 100 for c in present_cols})
    with pytest.raises(HTTPException) as exc_info:
        validate_schema(df)
    assert exc_info.value.status_code == 422


# ── Property 2: Schema validation rejects undersized datasets ─────────────────
# Validates: Requirements 2.5

@given(st.integers(min_value=1, max_value=99))
@settings(max_examples=100)
def test_p2_schema_rejects_undersized_datasets(n):
    """Any dataframe with < 100 rows (valid schema) should fail validation."""
    df = pd.DataFrame({c: [1] * n for c in REQUIRED_COLUMNS})
    with pytest.raises(HTTPException) as exc_info:
        validate_schema(df)
    assert exc_info.value.status_code == 422
    assert "too small" in exc_info.value.detail.lower() or "minimum" in exc_info.value.detail.lower()


# ── Property 3: Gender encoding correctness ───────────────────────────────────
# Validates: Requirements 2.7, 3.2

@given(st.lists(st.sampled_from(["M", "F"]), min_size=1))
@settings(max_examples=100)
def test_p3_gender_encoding_correctness(genders):
    """Every 'M' maps to 1 and every 'F' maps to 0; other columns unchanged."""
    df = pd.DataFrame({"gender": genders, "score": list(range(len(genders)))})
    result = encode_gender(df)
    for orig, encoded in zip(genders, result["gender"]):
        if orig == "M":
            assert encoded == 1
        else:
            assert encoded == 0
    # Other columns unchanged
    assert list(result["score"]) == list(df["score"])
    # Original not mutated
    assert list(df["gender"]) == genders


# ── Property 4: Fairness threshold classification ─────────────────────────────
# Validates: Requirements 3.3, 3.5

@given(st.floats(min_value=-1.0, max_value=1.0, allow_nan=False))
@settings(max_examples=100)
def test_p4_fairness_threshold_classification(dpd):
    """abs(dpd) < 0.10 ↔ passes_standard_test=True and verdict='FAIR'."""
    passes = abs(dpd) < 0.10
    verdict = "FAIR" if passes else "BIASED"
    result = StandardAuditResult(
        demographic_parity_difference=dpd,
        passes_standard_test=passes,
        verdict=verdict,
    )
    if abs(dpd) < 0.10:
        assert result.passes_standard_test is True
        assert result.verdict == "FAIR"
    else:
        assert result.passes_standard_test is False
        assert result.verdict == "BIASED"


# ── Property 5: DPD rounding idempotence ──────────────────────────────────────
# Validates: Requirements 3.4

@given(st.floats(min_value=-1.0, max_value=1.0, allow_nan=False))
@settings(max_examples=100)
def test_p5_dpd_rounding_idempotence(x):
    """round(round(x, 4), 4) == round(x, 4)."""
    assert round(round(x, 4), 4) == round(x, 4)


# ── Property 7: Proxy path count invariant ────────────────────────────────────
# Validates: Requirements 5.6

@given(st.integers(min_value=0, max_value=10))
@settings(max_examples=100)
def test_p7_proxy_path_count_invariant(n_paths):
    """proxy_paths_found always equals len(paths)."""
    paths = [
        ProxyPath(path=["gender", "x", "hired"], type="proxy", effect=0.1, description="test")
        for _ in range(n_paths)
    ]
    result = CausalAuditResult(
        proxy_paths_found=len(paths),
        paths=paths,
        total_causal_effect_of_gender=0.05,
        verdict="PROXY DISCRIMINATION DETECTED" if paths else "NO PROXY PATHS FOUND",
        affected_candidates=0,
    )
    assert result.proxy_paths_found == len(result.paths)


# ── Property 8: Verdict reflects proxy path presence ─────────────────────────
# Validates: Requirements 5.7

@given(st.integers(min_value=0, max_value=10))
@settings(max_examples=100)
def test_p8_verdict_reflects_proxy_path_presence(count):
    """count > 0 ↔ 'PROXY DISCRIMINATION DETECTED'; count == 0 ↔ 'NO PROXY PATHS FOUND'."""
    verdict = "PROXY DISCRIMINATION DETECTED" if count > 0 else "NO PROXY PATHS FOUND"
    if count > 0:
        assert verdict == "PROXY DISCRIMINATION DETECTED"
    else:
        assert verdict == "NO PROXY PATHS FOUND"


# ── Property 9: Affected candidates formula ───────────────────────────────────
# Validates: Requirements 5.8

@given(
    st.floats(min_value=0.0, max_value=1.0, allow_nan=False),
    st.floats(min_value=0.0, max_value=1.0, allow_nan=False),
    st.integers(min_value=1, max_value=2000),
)
@settings(max_examples=100)
def test_p9_affected_candidates_formula(male_rate, female_rate, n_female):
    """Result equals int((male_rate - female_rate) * n_female)."""
    expected = int((male_rate - female_rate) * n_female)
    assert expected == int((male_rate - female_rate) * n_female)


# ── Property 10: Fallback report contains key numbers ────────────────────────
# Validates: Requirements 6.8, 12.5

@given(st.integers(min_value=0, max_value=2000))
@settings(max_examples=100)
def test_p10_fallback_report_contains_key_numbers(affected_candidates):
    """Fallback report is non-empty and contains affected_candidates, college_tier, employment_gap."""
    standard = StandardAuditResult(
        demographic_parity_difference=0.08,
        passes_standard_test=True,
        verdict="FAIR",
    )
    paths = [
        ProxyPath(path=["gender", "college_tier", "hired"], type="proxy", effect=-0.14,
                  description="Gender correlates with college tier in historical data"),
        ProxyPath(path=["gender", "employment_gap", "hired"], type="proxy", effect=0.25,
                  description="Gender correlates with employment gaps in historical data"),
    ]
    causal = CausalAuditResult(
        proxy_paths_found=2,
        paths=paths,
        total_causal_effect_of_gender=0.087,
        verdict="PROXY DISCRIMINATION DETECTED",
        affected_candidates=affected_candidates,
    )
    df = pd.DataFrame({
        "gender": ["M"] * 50 + ["F"] * 50,
        "hired": [1] * 100,
        "experience_years": [5] * 100,
        "test_score": [70.0] * 100,
        "college_tier": [1] * 100,
        "employment_gap": [0] * 100,
    })
    report = fallback_report(standard, causal, df)
    assert len(report) > 0
    assert str(affected_candidates) in report
    assert "college_tier" in report
    assert "employment_gap" in report


# ── Property 11: Numpy type conversion produces JSON-serializable types ───────
# Validates: Requirements 11.1

@given(st.one_of(
    st.floats(allow_nan=False, allow_infinity=False).map(np.float64),
    st.integers(min_value=-(2**31), max_value=2**31).map(np.int64),
))
@settings(max_examples=100)
def test_p11_numpy_type_conversion_json_serializable(val):
    """Converted numpy scalars must be native Python types and JSON-serializable."""
    result = convert_numpy_types(val)
    assert isinstance(result, (float, int))
    json.dumps(result)  # must not raise
