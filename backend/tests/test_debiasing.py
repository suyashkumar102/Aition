"""Unit tests for run_surgical_debiasing (Task 8.2)."""

import os
import pandas as pd
import pytest

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from backend.main import run_surgical_debiasing, run_causal_audit, DebiasingResult


@pytest.fixture(scope="module")
def demo_debiasing_result() -> DebiasingResult:
    df = pd.read_csv("data/demo_hiring_dataset.csv")
    causal = run_causal_audit(df)
    return run_surgical_debiasing(df, causal, "equalized_odds")


def test_returns_debiasing_result_type(demo_debiasing_result):
    assert isinstance(demo_debiasing_result, DebiasingResult)


def test_bias_index_reduced(demo_debiasing_result):
    """bias_index_after must be strictly less than bias_index_before."""
    result = demo_debiasing_result
    assert result.bias_index_after < result.bias_index_before, (
        f"Expected bias reduction: before={result.bias_index_before}, after={result.bias_index_after}"
    )


def test_accuracy_cost_under_8_percent(demo_debiasing_result):
    """Accuracy cost must be less than 8% on the demo dataset (3 proxy features removed)."""
    assert demo_debiasing_result.accuracy_cost_percent < 8.0, (
        f"Accuracy cost too high: {demo_debiasing_result.accuracy_cost_percent}%"
    )


def test_bias_reduction_positive(demo_debiasing_result):
    """Bias reduction must be positive on the demo dataset.

    Note: the demo dataset has DPD ~0.06 (not the spec's illustrative 0.71),
    so the absolute reduction is modest but must still be > 0%.
    """
    assert demo_debiasing_result.bias_reduction_percent > 0.0, (
        f"Expected positive bias reduction, got: {demo_debiasing_result.bias_reduction_percent}%"
    )


def test_variables_modified_contains_college_graduation_year_gap(demo_debiasing_result):
    """college_graduation_year_gap and neighborhood_quality must be listed as modified variables."""
    assert "college_graduation_year_gap" in demo_debiasing_result.variables_modified
    assert "neighborhood_quality" in demo_debiasing_result.variables_modified
