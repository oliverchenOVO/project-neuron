"""Record real offline CPU benchmark evidence, not expected or mocked values."""
import argparse
import json
import os
from pathlib import Path
import platform
import time
import torch
from engine.inference import AnalysisEngine
from engine.model_loader import ModelLoader


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="resources/models/gpt2")
    parser.add_argument("--output", default="artifacts/phase0-evidence.json")
    args = parser.parse_args()
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    start = time.perf_counter()
    loader = ModelLoader(args.model_dir, offline=True)
    loader.load()
    loading_ms = (time.perf_counter() - start) * 1000
    engine = AnalysisEngine(loader)
    measurements = []
    for text in ["The cat sat on the mat", " hello" * 64]:
        start = time.perf_counter()
        result = engine.analyze(text)
        elapsed = (time.perf_counter() - start) * 1000
        payload = json.dumps(result, ensure_ascii=False, allow_nan=False).encode("utf-8")
        attention = torch.tensor(result["attention_matrices"])
        similarities = torch.tensor(result["hidden_similarity"])
        cached = engine.analyze(text)
        measurements.append({"tokens": len(result["tokens"]), "analysis_ms": elapsed,
            "forward_ms": result["metadata"]["forward_ms"], "payload_bytes": len(payload),
            "cache_request_ms": cached["metadata"]["request_ms"],
            "max_attention_row_sum_error": float((attention.sum(-1) - 1).abs().max()),
            "max_future_attention": float(torch.triu(attention, diagonal=1).abs().max()),
            "max_cosine_diagonal_error": float((similarities.diagonal(dim1=-2,dim2=-1) - 1).abs().max()),
            "max_cosine_symmetry_error": float((similarities - similarities.transpose(-1,-2)).abs().max()),
            "final_top_k": result["final_top_k"]})
    evidence = {"model_metadata": result["metadata"], "platform": platform.platform(),
                "python": platform.python_version(), "cpu_threads": torch.get_num_threads(),
                "load_ms": loading_ms, "benchmarks": measurements,
                "load_measurement": "fresh model object after Python imports; OS cache may be warm; not complete app startup",
                "scope": "Phase 0 only. Electron, UI and installer gates not tested."}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(evidence, indent=2, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    print(json.dumps({"load_ms": loading_ms, "benchmarks": [{k:v for k,v in m.items()
          if k != "final_top_k"} for m in measurements]}, indent=2))


if __name__ == "__main__":
    main()
