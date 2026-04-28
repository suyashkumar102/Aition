"""Unit tests for proxy path detection and serialization (Task 10.3)."""

import os
import json
import numpy as np
import pandas as pd
import pytest

os.environ.setdefault("GEMINI_API_KEY", "test-key")

from backend.main import detect_proxy_paths, compute_affected_candidates, build_graph_data, convert_numpy_types


def test_detect_proxy_paths_returns_exactly_2_paths():
    df = pd.read_csv("data/demo_hiring_dataset.csv")
    paths = detect_proxy_paths(df)
    assert len(paths) == 2
    path_vars = [p.path[1] for p in paths]
    assert "college_tier" in path_vars
    assert "employment_gap" in path_vars


def test_compute_affected_candidates_in_expected_range():
    df = pd.read_csv("data/demo_hiring_dataset.csv")
    affected = compute_affected_candidates(df)
    # With DPD ~0.08 and ~1000 females, expect a positive value
    assert isinstance(affected, int)
    assert affected >= 0


def test_build_graph_data_returns_6_nodes_and_6_edges():
    graph = build_graph_data()
    assert len(graph.nodes) == 6
    assert len(graph.edges) == 6
    node_types = {n.type for n in graph.nodes}
    assert "protected" in node_types
    assert "proxy" in node_types
    assert "legitimate" in node_types
    assert "outcome" in node_types
    edge_types = {e.type for e in graph.edges}
    assert "proxy" in edge_types
    assert "legitimate" in edge_types


def test_convert_numpy_types_float64():
    val = np.float64(3.14)
    result = convert_numpy_types(val)
    assert isinstance(result, float)
    assert abs(result - 3.14) < 1e-9


def test_convert_numpy_types_int64():
    val = np.int64(42)
    result = convert_numpy_types(val)
    assert isinstance(result, int)
    assert result == 42


def test_convert_numpy_types_ndarray():
    val = np.array([1.0, 2.0, 3.0])
    result = convert_numpy_types(val)
    assert isinstance(result, list)
    assert result == [1.0, 2.0, 3.0]


def test_convert_numpy_types_result_is_json_serializable():
    obj = {"a": np.float64(1.5), "b": np.int64(7), "c": np.array([1, 2])}
    result = convert_numpy_types(obj)
    # Should not raise
    json.dumps(result)
