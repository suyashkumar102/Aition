"""Unit tests for standard fairness metric computation (Task 10.2)."""

import os
import pandas as pd
import pytest

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from backend.main import compute_standard_fairness


def _make_df(male_hired: int, male_total: int, female_hired: int, female_total: int) -> pd.DataFrame:
    """Build a minimal dataframe with controlled hire rates."""
    rows = []
    for _ in range(male_hired):
        rows.append({"gender": "M", "experience_years": 5, "test_score": 70.0,
                     "college_tier": 1, "employment_gap": 0, "hired": 1})
    for _ in range(male_total - male_hired):
        rows.append({"gender": "M", "experience_years": 5, "test_score": 70.0,
                     "college_tier": 1, "employment_gap": 0, "hired": 0})
    for _ in range(female_hired):
        rows.append({"gender": "F", "experience_years": 5, "test_score": 70.0,
                     "college_tier": 1, "employment_gap": 0, "hired": 1})
    for _ in range(female_total - female_hired):
        rows.append({"gender": "F", "experience_years": 5, "test_score": 70.0,
                     "college_tier": 1, "employment_gap": 0, "hired": 0})
    return pd.DataFrame(rows)


def test_compute_standard_fairness_fair_on_demo_dataset():
    """Demo dataset should produce verdict='FAIR' (DPD < 0.10)."""
    df = pd.read_csv("data/demo_hiring_dataset.csv")
    result = compute_standard_fairness(df)
    assert result.verdict == "FAIR"
    assert result.passes_standard_test is True
    assert abs(result.demographic_parity_difference) < 0.10


def test_compute_standard_fairness_biased_on_high_dpd_dataset():
    """Synthetic dataset with DPD ~0.15 should produce verdict='BIASED'."""
    # male hire rate = 0.65, female hire rate = 0.50 → DPD = 0.15
    df = _make_df(male_hired=65, male_total=100, female_hired=50, female_total=100)
    result = compute_standard_fairness(df)
    assert result.verdict == "BIASED"
    assert result.passes_standard_test is False
    assert abs(result.demographic_parity_difference) >= 0.10


def test_dpd_is_rounded_to_4_decimal_places():
    """Returned DPD must satisfy round(dpd, 4) == dpd."""
    df = pd.read_csv("data/demo_hiring_dataset.csv")
    result = compute_standard_fairness(df)
    dpd = result.demographic_parity_difference
    assert round(dpd, 4) == dpd
