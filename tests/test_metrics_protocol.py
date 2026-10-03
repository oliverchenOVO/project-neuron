from io import StringIO
import json
import subprocess
import sys
import socket
import pytest
import torch
from engine.errors import EngineError
from engine.inference import AnalysisEngine
from engine.model_loader import ModelLoader
from engine.projection import pca_2d
from engine.protocol import serve
from engine.similarity import cosine_matrix


@pytest.mark.parametrize("hidden", [torch.zeros(1, 4), torch.ones(4, 3), torch.tensor([[1., 2.], [3., 4.]])])
def test_degenerate_pca(hidden):
    result = pca_2d(hidden)
    assert torch.isfinite(torch.tensor(result["coordinates"])).all()
    assert torch.tensor(result["coordinates"]).shape == (len(hidden), 2)


def test_zero_cosine_defined():
    assert torch.equal(cosine_matrix(torch.zeros(2, 3)), torch.zeros(2, 2))


def test_missing_local_model(tmp_path):
    loader = ModelLoader(tmp_path / "missing")
    with pytest.raises(EngineError) as exc:
        loader.load()
    assert exc.value.code == "MODEL_NOT_FOUND"
    assert loader.status()["stage"] == "failed"
    assert loader.model is None


@pytest.mark.parametrize("top_k", [0, 51, True, 2.5, "10"])
def test_top_k_validation(top_k):
    with pytest.raises(EngineError) as exc:
        AnalysisEngine().analyze("hello", top_k)
    assert exc.value.code == "INVALID_PARAMS"


def test_rpc_malformed_and_methods():
    engine = AnalysisEngine()
    requests = ['{bad}', '[]', '{"id":1,"method":"ping"}',
                '{"id":2,"method":"status"}', '{"id":3,"method":"unknown"}',
                '{"id":4,"method":"analyze","params":[]}',
                '{"id":5,"method":"shutdown"}', '{"id":6,"method":"ping"}']
    output = StringIO()
    serve(engine, StringIO("\n".join(requests) + "\n"), output)
    responses = [json.loads(x) for x in output.getvalue().splitlines()]
    assert len(responses) == 7
    assert responses[0]["error"]["code"] == "PARSE_ERROR"
    assert responses[1]["error"]["code"] == "INVALID_REQUEST"
    assert responses[2]["result"]["pong"]
    assert responses[3]["result"]["stage"] == "idle"
    assert responses[4]["error"]["code"] == "METHOD_NOT_FOUND"
    assert responses[5]["error"]["code"] == "INVALID_PARAMS"
    assert responses[6]["result"]["shutdown"]


@pytest.mark.real_model
def test_real_worker_subprocess_roundtrip(real_engine):
    args = [sys.executable, "-m", "engine.protocol", "--offline"]
    if real_engine.loader.model_dir:
        args += ["--model-dir", str(real_engine.loader.model_dir)]
    requests = [{"id":1,"method":"ping"}, {"id":2,"method":"status"},
                {"id":3,"method":"analyze","params":{"text":"The cat sat on the mat"}},
                {"id":4,"method":"status"}, {"id":5,"method":"shutdown"}]
    completed = subprocess.run(args, input="".join(json.dumps(r)+"\n" for r in requests),
                               capture_output=True, encoding="utf-8", timeout=180)
    assert completed.returncode == 0, completed.stderr
    lines = [json.loads(line) for line in completed.stdout.splitlines()]
    assert [r["id"] for r in lines] == [1, 2, 3, 4, 5]
    assert lines[2]["result"]["token_ids"] == [464,3797,3332,319,262,2603]
    assert lines[2]["result"]["layer_count"] == 12
    assert lines[3]["result"]["stage"] == "ready"


@pytest.mark.real_model
def test_offline_load_and_forward_with_network_blocked(real_engine, monkeypatch):
    def deny_network(*args, **kwargs):
        raise AssertionError("Offline model loading attempted network access")
    monkeypatch.setattr(socket.socket, "connect", deny_network)
    monkeypatch.setattr(socket, "create_connection", deny_network)
    loader = ModelLoader(real_engine.loader.model_dir, offline=True)
    result = AnalysisEngine(loader).analyze("Hello")
    assert result["metadata"]["local_only_loading"]
    assert loader.status()["stage"] == "ready"
