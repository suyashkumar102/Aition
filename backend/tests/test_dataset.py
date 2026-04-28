"""Unit tests for dataset loading and validation (Task 10.1)."""

import os
import pandas as pd
import pytest

# Set env var before importing backend.main (which validates GEMINI_API_KEY at import)
os.environ.setdefault("GEMINI_API_KEY", "test-key")

from fastapi import HTTPException
from backend.main import validate_schema, encode_gender, REQUIRED_COLUMNS


def _make_valid_df(n: int = 100) -> pd.DataFrame:
    """Return a minimal valid dataframe with all required columns."""
    return pd.DataFrame({
        "gender": ["M"] * (n // 2) + ["F"] * (n - n // 2),
        "experience_years": [5] * n,
        "test_score": [70.0] * n,
        "college_tier": [1] * n,
        "employment_gap": [0] * n,
        "hired": [1] * n,
    })


def test_validate_schema_raises_422_when_hired_missing():
    df = _make_valid_df()
    df = df.drop(columns=["hired"])
    with pytest.raises(HTTPException) as exc_info:
        validate_schema(df)
    assert exc_info.value.status_code == 422
    assert "hired" in str(exc_info.value.detail)


def test_validate_schema_raises_422_when_row_count_is_99():
    df = _make_valid_df(n=99)
    with pytest.raises(HTTPException) as exc_info:
        validate_schema(df)
    assert exc_info.value.status_code == 422
    assert "too small" in exc_info.value.detail.lower() or "minimum" in exc_info.value.detail.lower()


def test_validate_schema_passes_for_valid_100_row_df():
    df = _make_valid_df(n=100)
    # Should not raise
    validate_schema(df)


def test_encode_gender_maps_m_to_1_and_f_to_0():
    df = pd.DataFrame({
        "gender": ["M", "F", "M"],
        "score": [80, 70, 90],
    })
    result = encode_gender(df)
    assert list(result["gender"]) == [1, 0, 1]
    # Other columns unchanged
    assert list(result["score"]) == [80, 70, 90]
    # Original df not mutated
    assert list(df["gender"]) == ["M", "F", "M"]
