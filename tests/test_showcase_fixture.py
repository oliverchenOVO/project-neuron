"""Public display fixtures preserve real inference signals; no numeric editing."""
from copy import deepcopy

from scripts.generate_showcase_fixture import fixture_result, PROMPTS


def test_fixture_keeps_real_signals(real_engine):
    original = real_engine.analyze(PROMPTS["showcase"])
    before = deepcopy(original)
    exported = fixture_result(real_engine, "showcase")
    assert original == before
    for key in original:
        if key != "metadata":
            assert exported[key] == original[key]
    for key, value in exported["metadata"].items():
        assert value == original["metadata"][key]
    assert exported["fixture"]["numerical_transformation"].startswith("none")
