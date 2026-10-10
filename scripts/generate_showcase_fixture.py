"""GENERATED FROM REAL GPT-2 OUTPUT — NOT MOCK DATA.

Only fixed public prompts are allowed. Never copy arbitrary private artifacts.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import time
import torch
from engine import ANALYSIS_VERSION
from engine.config import MODEL_ID, MODEL_REVISION
from engine.inference import AnalysisEngine
from engine.model_loader import ModelLoader

GENERATOR_VERSION = "1.2.0"
PROMPTS = {"showcase": "The cat sat on the mat", "stress-64": " hello" * 64}
ROOT = Path(__file__).resolve().parents[1]


def fixture_result(engine, name, timings=None):
    result = engine.analyze(PROMPTS[name])
    if timings is not None:
        timings.update({key:result["metadata"][key] for key in ("forward_ms","analysis_ms","new_metrics_ms","cache_hit")})
    if result["metadata"]["model_revision"] != MODEL_REVISION:
        raise RuntimeError("Fixture generation requires the verified pinned local checkpoint.")
    # These fields describe the generator machine/timing, not model-derived
    # values. Omit them from committed fixtures; tensors/metrics are untouched.
    metadata = {k:v for k,v in result["metadata"].items() if k not in
                {"model_source", "cache_hit", "forward_ms", "analysis_ms", "request_ms", "new_metrics_ms", "prediction_evolution_ms"}}
    result["metadata"] = metadata
    result["fixture"] = {"notice":"GENERATED FROM REAL GPT-2 OUTPUT — NOT MOCK DATA",
        "name":name,"public_prompt":PROMPTS[name],"generator_version":GENERATOR_VERSION,
        "model_revision":MODEL_REVISION,"analysis_schema_version":ANALYSIS_VERSION,
        "numerical_transformation":"none; original engine values preserved",
        "provenance":"Pinned official safetensors; offline CPU forward pass"}
    return result


def serialize(result):
    return json.dumps(result,ensure_ascii=False,allow_nan=False,separators=(",",":")).encode("utf-8")


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--model-dir",default=str(ROOT/"resources/models/gpt2"))
    parser.add_argument("--output",default=str(ROOT/"frontend/public/fixtures/phase1b"))
    parser.add_argument("--verify-reproducibility",action="store_true")
    args=parser.parse_args()
    torch.set_num_threads(min(4,os.cpu_count() or 1))
    loader=ModelLoader(args.model_dir,offline=True)
    engine=AnalysisEngine(loader)
    load_started=time.perf_counter()
    loader.load()
    model_load_ms=(time.perf_counter()-load_started)*1000
    folder=Path(args.output)
    folder.mkdir(parents=True,exist_ok=True)
    evidence=[]
    for name in PROMPTS:
        started=time.perf_counter()
        timings={}
        result=fixture_result(engine,name,timings)
        first=serialize(result)
        if args.verify_reproducibility:
            # A new uncached forward pass, not a cache replay.
            engine.cache.clear()
            assert serialize(fixture_result(engine,name)) == first, "Non-reproducible numeric fixture"
        (folder/f"{name}.json").write_bytes(first)
        evidence.append({"name":name,"bytes":len(first),"sha256":hashlib.sha256(first).hexdigest(),
                         "tokens":len(result["tokens"]),"generation_and_verification_ms":(time.perf_counter()-started)*1000,
                         "uncached_reproducibility_verified":args.verify_reproducibility})
        evidence[-1]["engine_timings"]={**timings,"model_load_ms":model_load_ms,
            "note":"forward_ms includes tokenizer and tensor checks; analysis_ms includes forward and derived metrics, excludes model loading and JSON serialization"}
        print(f"{name}: real GPT-2, {len(result['tokens'])} tokens, {len(first):,} bytes",flush=True)
    manifest={"notice":"GENERATED FROM REAL GPT-2 OUTPUT — NOT MOCK DATA","model":MODEL_ID,
              "model_revision":MODEL_REVISION,"analysis_schema_version":ANALYSIS_VERSION,
              "generator_version":GENERATOR_VERSION,
              "files":[{k:v for k,v in e.items() if k not in {"generation_and_verification_ms","uncached_reproducibility_verified","engine_timings"}} for e in evidence]}
    (folder/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    artifact=ROOT/"artifacts/fixture-generation.json"
    artifact.parent.mkdir(exist_ok=True)
    artifact.write_text(json.dumps(evidence,indent=2),encoding="utf-8")


if __name__=="__main__":
    main()
