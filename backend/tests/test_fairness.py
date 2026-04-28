"""Unit tests for standard fairness metric computation (Task 10.2)."""

import os
import pandas as pd
import pytest

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from backend.main import compute_standard_fairness


def _make_df(young_hired: int, young_total: int, senior_hired: int, senior_total: int) -> pd.DataFrame:
    """Build a minimal dataframe with controlled hire rates (equal SES split, neutral neighbourhood)."""
    rows = []
    half = (young_total + senior_total) // 2
    for i, (ag, hired_count, total) in enumerate([
        ("Young", young_hired, young_total),
        ("Senior", senior_hired, senior_total),
    ]):
        for j in range(hired_count):
            rows.append({"age_group": ag, "socioeconomic_group": "High" if j % 2 == 0 else "Low",
                         "experience_years": 5, "test_score": 70.0,
                         "college_graduation_year_gap": 0, "employment_gap": 0,
                         "neighborhood_quality": 1, "hired": 1})
        for j in range(total - hired_count):
            rows.append({"age_group": ag, "socioeconomic_group": "High" if j % 2 == 0 else "Low",
                         "experience_years": 5, "test_score": 70.0,
                         "college_graduation_year_gap": 0, "employment_gap": 0,
                         "neighborhood_quality": 1, "hired": 0})
    return pd.DataFrame(rows)


def test_compute_standard_fairness_fair_on_demo_dataset():
    """Demo dataset should produce verdict='FAIR' (both DPDs < 0.10)."""
    df = pd.read_csv("data/demo_hiring_dataset.csv")
    result = compute_standard_fairness(df)
    assert result.verdict == "FAIR"
    assert result.passes_standard_test is True
    assert abs(result.demographic_parity_difference) < 0.10
    assert abs(result.ses_parity_difference) < 0.10


def test_compute_standard_fairness_biased_on_high_dpd_dataset():
    """Synthetic dataset with age DPD ~0.15 should produce verdict='BIASED'."""
    df = _make_df(young_hired=65, young_total=100, senior_hired=50, senior_total=100)
    result = compute_standard_fairness(df)
    assert result.verdict == "BIASED"
    assert result.passes_standard_test is False
    assert abs(result.demographic_parity_difference) >= 0.10


def test_dpd_is_rounded_to_4_decimal_places():
    """Returned DPDs must satisfy round(dpd, 4) == dpd."""
    df = pd.read_csv("data/demo_hiring_dataset.csv")
    result = compute_standard_fairness(df)
    assert round(result.demographic_parity_difference, 4) == result.demographic_parity_difference
    assert round(result.ses_parity_difference, 4) == result.ses_parity_difference
