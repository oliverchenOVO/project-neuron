import argparse
import json
import os
from pathlib import Path
import sys
import torch
from .errors import EngineError
from .inference import AnalysisEngine
from .model_loader import ModelLoader


def main():
    parser = argparse.ArgumentParser(description="Real GPT-2 forward-pass smoke test")
    parser.add_argument("text", nargs="?", default="The cat sat on the mat")
    parser.add_argument("--output", default="artifacts/phase0-analysis.json")
    parser.add_argument("--model-dir")
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--device", choices=["cpu", "cuda"], default="cpu")
    args = parser.parse_args()
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        result = AnalysisEngine(ModelLoader(args.model_dir, args.offline, args.device)).analyze(args.text)
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2), encoding="utf-8")
        print("Tokens:", [t["piece"] for t in result["tokens"]])
        print("Token IDs:", result["token_ids"])
        print("Layers:", result["layer_count"], "Heads:", result["head_count"])
        print("Tensor shapes:", json.dumps(result["tensor_shapes"]))
        print("Top-10 next-token predictions (final logits + full-vocabulary softmax):")
        for item in result["final_top_k"]:
            print(f"  {item['token']!r:18} ID {item['token_id']:5}  {item['probability']:.6%}")
        print(f"Analysis: {result['metadata']['analysis_ms']:.1f} ms; JSON: {out.resolve()}")
    except EngineError as exc:
        print(json.dumps({"error": exc.as_dict()}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
