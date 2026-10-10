import torch
import pytest
from engine.prediction import lens_logits, logit_lens


def test_candidate_identity_and_schema(analysis):
    evolution = analysis["prediction_evolution"]
    assert analysis["metadata"]["analysis_version"] == "0.3.0"
    assert evolution["position"] == 5
    assert evolution["stages"] == ["EMB", *[f"L{i:02}" for i in range(1, 13)], "OUT"]
    assert [c["token_id"] for c in evolution["candidates"]] == [c["token_id"] for c in analysis["final_top_k"][:5]]


def test_each_projection_and_full_vocab_normalization(real_engine, signals, analysis):
    model = real_engine.loader.model
    with torch.inference_mode():
        projected = lens_logits(model, signals.representations)
        existing = logit_lens(model, signals.representations, real_engine.loader.tokenizer)
    assert existing == analysis["logit_lens_top_k"]
    for stage, values in enumerate([*projected, signals.logits[0, -1]]):
        full = torch.softmax(values.double(), dim=-1)
        assert float(full.sum()) == pytest.approx(1, abs=1e-12)
        for c in analysis["prediction_evolution"]["candidates"]:
            assert c["logits"][stage] == float(values[c["token_id"]])
            assert c["probabilities"][stage] == float(full[c["token_id"]])
            assert 0 <= c["probabilities"][stage] <= 1


def test_out_matches_genuine_forward_ranking(signals, analysis):
    assert torch.topk(signals.logits[0, -1], 5).indices.tolist() == [c["token_id"] for c in analysis["prediction_evolution"]["candidates"]]
    for c, final in zip(analysis["prediction_evolution"]["candidates"], analysis["final_top_k"]):
        assert len(c["logits"]) == len(c["probabilities"]) == 14
        assert c["logits"][-1] == final["logit"]
        assert c["probabilities"][-1] == final["probability"]


def test_maximum_context_evolution_finite(real_engine):
    result = real_engine.analyze(" hello" * 64)
    assert result["prediction_evolution"]["position"] == 63
    for c in result["prediction_evolution"]["candidates"]:
        assert torch.isfinite(torch.tensor(c["logits"])).all()
        assert torch.isfinite(torch.tensor(c["probabilities"])).all()
    assert len(result["prediction_evolution"]["candidates"]) == 5
