"""Unit tests for compute_impossibility_surface (Task 8.1)."""

import os
import pandas as pd
import pytest

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from backend.main import compute_impossibility_surface, ImpossibilitySurface

EXPECTED_STEPS = 17  # thresholds 0.10 to 0.90 in 0.05 steps


@pytest.fixture(scope="module")
def demo_surface() -> ImpossibilitySurface:
    df = pd.read_csv("data/demo_hiring_dataset.csv")
    return compute_impossibility_surface(df)


def test_returns_impossibility_surface_type(demo_surface):
    assert isinstance(demo_surface, ImpossibilitySurface)


def test_frontier_points_count(demo_surface):
    """Must return exactly 17 frontier points (thresholds 0.10–0.90 in 0.05 steps)."""
    assert len(demo_surface.frontier_points) == EXPECTED_STEPS


def test_frontier_points_are_pairs_of_floats(demo_surface):
    """Each frontier point must be a list of exactly 2 floats."""
    for point in demo_surface.frontier_points:
        assert isinstance(point, list), f"Expected list, got {type(point)}"
        assert len(point) == 2, f"Expected 2 elements, got {len(point)}"
        assert isinstance(point[0], float), f"dpd not float: {point[0]}"
        assert isinstance(point[1], float), f"eod not float: {point[1]}"


def test_frontier_points_in_unit_interval(demo_surface):
    """Both dpd and eod in each frontier point must be in [0, 1]."""
    for point in demo_surface.frontier_points:
        dpd, eod = point
        assert 0.0 <= dpd <= 1.0, f"dpd out of range: {dpd}"
        assert 0.0 <= eod <= 1.0, f"eod out of range: {eod}"


def test_current_position_is_valid_pair(demo_surface):
    """current_position must be a [dpd, eod] pair with values in [0, 1]."""
    pos = demo_surface.current_position
    assert isinstance(pos, list)
    assert len(pos) == 2
    dpd, eod = pos
    assert 0.0 <= dpd <= 1.0, f"current dpd out of range: {dpd}"
    assert 0.0 <= eod <= 1.0, f"current eod out of range: {eod}"


def test_accuracy_at_threshold_count(demo_surface):
    """Must return exactly 17 accuracy values."""
    assert len(demo_surface.accuracy_at_threshold) == EXPECTED_STEPS


def test_accuracy_at_threshold_in_unit_interval(demo_surface):
    """All accuracy values must be in [0, 1]."""
    for acc in demo_surface.accuracy_at_threshold:
        assert 0.0 <= acc <= 1.0, f"accuracy out of range: {acc}"
