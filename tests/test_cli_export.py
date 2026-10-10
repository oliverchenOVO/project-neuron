"""CLI exports preserve the exact original Unicode prompt for browser imports."""
import json
from engine import cli


def test_cli_preserves_unicode_prompt_and_real_metrics(real_engine, tmp_path, monkeypatch):
    text = "你好，Transformer 🔬"
    output = tmp_path / "unicode-analysis.json"
    monkeypatch.setattr(cli, "ModelLoader", lambda *_: real_engine.loader)
    monkeypatch.setattr(cli, "AnalysisEngine", lambda _: real_engine)
    monkeypatch.setattr("sys.argv", ["neuron", text, "--offline", "--output", str(output)])
    assert cli.main() == 0
    exported = json.loads(output.read_text(encoding="utf-8"))
    assert exported["input_text"] == text
    assert real_engine.loader.tokenizer.decode(exported["token_ids"], clean_up_tokenization_spaces=False) == text
    reference = real_engine.analyze(text)
    assert exported["attention_matrices"] == reference["attention_matrices"]
    assert exported["shared_pca"] == reference["shared_pca"]
    assert "input_text" not in reference  # CLI annotation must not leak into engine cache.
