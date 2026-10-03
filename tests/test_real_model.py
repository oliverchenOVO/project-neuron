import json
import pytest
import torch
from engine.errors import EngineError
from engine.prediction import top_predictions
from engine.projection import pca_2d
from engine.similarity import cosine_matrix
from engine.tokenizer_analysis import tokenize
from .conftest import PROMPT

pytestmark = pytest.mark.real_model


def test_tokenization_deterministic(real_engine, signals):
    ids, tokens = tokenize(real_engine.loader.tokenizer, PROMPT)
    assert torch.equal(ids, signals.input_ids.cpu())
    assert ids[0].tolist() == [464, 3797, 3332, 319, 262, 2603]
    assert tokens == signals.tokens
    assert [t["piece"] for t in tokens] == ["The", "Ġcat", "Ġsat", "Ġon", "Ġthe", "Ġmat"]


def test_hidden_states_shapes(signals):
    assert len(signals.hf_hidden_states) == 13
    assert all(h.shape == (1, 6, 768) for h in signals.hf_hidden_states)
    assert len(signals.representations) == 13
    assert all(h.shape == (6, 768) for h in signals.representations)


def test_embeddings_are_word_plus_position(signals):
    assert signals.word_embeddings.shape == (1, 6, 768)
    assert signals.position_embeddings.shape == (1, 6, 768)
    torch.testing.assert_close(signals.representations[0],
                               (signals.word_embeddings + signals.position_embeddings)[0])


def test_attention_shapes(signals):
    assert len(signals.attentions) == 12
    assert all(a.shape == (1, 12, 6, 6) for a in signals.attentions)


def test_attention_row_sum(signals):
    for a in signals.attentions:
        torch.testing.assert_close(a.sum(-1), torch.ones_like(a.sum(-1)), atol=1e-5, rtol=1e-5)
        assert (a >= 0).all()


def test_causal_future_mask(signals):
    for a in signals.attentions:
        assert torch.count_nonzero(torch.triu(a, diagonal=1)) == 0


def test_final_logits_and_softmax(signals, real_engine, analysis):
    assert signals.logits.shape == (1, 6, 50257)
    assert torch.isfinite(signals.logits).all()
    probabilities = torch.softmax(signals.logits[0, -1].float(), dim=-1)
    assert probabilities.sum().item() == pytest.approx(1, abs=1e-6)
    expected = top_predictions(signals.logits[0, -1], real_engine.loader.tokenizer)
    assert analysis["final_top_k"] == expected
    assert sum(p["probability"] for p in expected) <= 1 + 1e-6


def test_cosine_self_similarity(signals):
    for h in signals.representations:
        torch.testing.assert_close(cosine_matrix(h).diag(), torch.ones(len(h)), atol=1e-5, rtol=1e-5)


def test_similarity_symmetry(signals):
    for h in signals.representations:
        matrix = cosine_matrix(h)
        torch.testing.assert_close(matrix, matrix.T, atol=1e-6, rtol=1e-6)


def test_pca_no_nan_inf(analysis):
    coordinates = torch.tensor(analysis["pca_coordinates"])
    assert coordinates.shape == (13, 6, 2)
    assert torch.isfinite(coordinates).all()
    torch.testing.assert_close(coordinates.mean(dim=1), torch.zeros(13, 2), atol=1e-3, rtol=0)
    ratios = torch.tensor(analysis["pca_explained_variance_ratio"])
    assert torch.isfinite(ratios).all()
    assert (ratios.sum(-1) <= 1.00001).all()


def test_logit_lens_finite_and_final_matches(real_engine, signals, analysis):
    with torch.inference_mode():
        for hidden in signals.representations:
            logits = real_engine.loader.model.lm_head(real_engine.loader.model.transformer.ln_f(hidden[-1]))
            assert torch.isfinite(logits).all()
        normalized = real_engine.loader.model.transformer.ln_f(signals.representations[-1])
        torch.testing.assert_close(normalized, signals.hf_hidden_states[-1][0])
        torch.testing.assert_close(real_engine.loader.model.lm_head(normalized), signals.logits[0])
    assert len(analysis["logit_lens_top_k"]) == 13
    for lens, final in zip(analysis["logit_lens_top_k"][-1], analysis["final_top_k"]):
        assert lens["token_id"] == final["token_id"]
        assert lens["probability"] == pytest.approx(final["probability"], abs=1e-6)


def test_magnitude_and_delta_formulas(signals, analysis):
    assert analysis["representation_delta"][0] == [None] * 6
    for i, hidden in enumerate(signals.representations):
        torch.testing.assert_close(torch.tensor(analysis["representation_magnitude"][i]), hidden.norm(dim=-1))
        if i:
            torch.testing.assert_close(torch.tensor(analysis["representation_delta"][i]),
                                       (hidden - signals.representations[i - 1]).norm(dim=-1))


def test_json_payload_no_raw_hidden_tensors(analysis):
    encoded = json.dumps(analysis, allow_nan=False)
    assert len(encoded.encode("utf-8")) < 200_000
    assert "raw_hidden_states" not in analysis
    assert analysis["metadata"]["attention_implementation"] == "eager"
    assert analysis["metadata"]["parameter_count"] == 124439808


def test_resident_cache_and_mutation_safety(real_engine, analysis):
    resident = real_engine.loader.model
    result = real_engine.analyze(PROMPT)
    assert result["metadata"]["cache_hit"]
    assert real_engine.loader.model is resident
    result["token_ids"][0] = -1
    assert real_engine.analyze(PROMPT)["token_ids"][0] == 464


def test_cache_key_includes_top_k(real_engine):
    result = real_engine.analyze(PROMPT, top_k=3)
    assert len(result["final_top_k"]) == 3
    assert all(len(x) == 3 for x in result["logit_lens_top_k"])


def test_input_too_long(real_engine):
    with pytest.raises(EngineError) as error:
        real_engine.analyze(" hello" * 65)
    assert error.value.code == "INPUT_TOO_LONG"


def test_exact_token_limit(real_engine):
    ids, _ = tokenize(real_engine.loader.tokenizer, " hello" * 64)
    assert ids.shape[1] == 64


def test_one_token_full_analysis(real_engine):
    result = real_engine.analyze("Hello")
    assert result["metadata"]["sequence_length"] == 1
    assert result["pca_coordinates"] == [[[0.0, 0.0]]] * 13
    assert all(len(a[0]) == 1 for a in result["attention_matrices"])


@pytest.mark.parametrize("text", ["", "  ", None, 42])
def test_invalid_input(real_engine, text):
    with pytest.raises(EngineError) as error:
        real_engine.analyze(text)
    assert error.value.code == "INVALID_INPUT"
