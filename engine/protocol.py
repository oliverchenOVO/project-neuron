"""Phase 0 worker scaffold: sequential JSON-line RPC, logs only on stderr."""
import argparse
from contextlib import redirect_stdout
import json
import os
import sys
import torch
from .errors import EngineError
from .inference import AnalysisEngine
from .model_loader import ModelLoader

MAX_LINE_BYTES = 128 * 1024


def handle(engine, request):
    if (not isinstance(request, dict) or not isinstance(request.get("id"), (int, str))
            or isinstance(request.get("id"), bool)):
        raise EngineError("INVALID_REQUEST", "Expected an object with an integer/string id.")
    method = request.get("method")
    params = request.get("params", {})
    if not isinstance(params, dict):
        raise EngineError("INVALID_PARAMS", "params must be an object.")
    if method == "ping":
        return {"pong": True}
    if method == "status":
        return engine.loader.status()
    if method == "shutdown":
        return {"shutdown": True}
    if method == "analyze":
        return engine.analyze(params.get("text"), params.get("top_k", 10))
    raise EngineError("METHOD_NOT_FOUND", f"Unknown method: {method}")


def serve(engine, input_stream, output_stream):
    while True:
        line = input_stream.readline(MAX_LINE_BYTES + 1)
        if not line:
            return
        request = None
        shutdown = False
        try:
            if len(line.encode("utf-8")) > MAX_LINE_BYTES:
                # Drain the rest of an oversized line before the next request.
                while not line.endswith("\n"):
                    line = input_stream.readline(MAX_LINE_BYTES + 1)
                    if not line:
                        break
                raise EngineError("INVALID_REQUEST", "RPC line exceeds 128 KiB.")
            request = json.loads(line)
            with redirect_stdout(sys.stderr):
                result = handle(engine, request)
            response = {"id": request["id"], "result": result}
            shutdown = request["method"] == "shutdown"
        except Exception as exc:
            error = exc if isinstance(exc, EngineError) else EngineError(
                "PARSE_ERROR" if isinstance(exc, json.JSONDecodeError) else "ANALYSIS_FAILED", str(exc))
            response = {"id": request.get("id") if isinstance(request, dict) else None,
                        "error": error.as_dict()}
        output_stream.write(json.dumps(response, ensure_ascii=False, allow_nan=False) + "\n")
        output_stream.flush()
        if shutdown:
            return


def main():
    parser = argparse.ArgumentParser(description="Project NEURON stdin/stdout worker")
    parser.add_argument("--model-dir")
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    for stream in (sys.stdin, sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    engine = AnalysisEngine(ModelLoader(args.model_dir, args.offline))
    serve(engine, sys.stdin, sys.stdout)


if __name__ == "__main__":
    main()
