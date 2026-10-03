"""Prepare a pinned local snapshot for CPU/offline validation and future builds."""
import argparse
import hashlib
import json
from pathlib import Path
from huggingface_hub import snapshot_download
from engine.config import MODEL_ID, MODEL_REVISION


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="resources/models/gpt2")
    args = parser.parse_args()
    directory = Path(args.output).resolve()
    snapshot_download(MODEL_ID, revision=MODEL_REVISION, local_dir=directory,
                      allow_patterns=["config.json", "generation_config.json", "model.safetensors",
                                      "tokenizer.json", "tokenizer_config.json", "vocab.json",
                                      "merges.txt", "README.md", "LICENSE*"])
    hashes = {}
    for file in sorted(directory.iterdir()):
        if file.is_file() and file.name != "neuron-provenance.json":
            digest = hashlib.sha256()
            with file.open("rb") as handle:
                for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(chunk)
            hashes[file.name] = digest.hexdigest()
    manifest = {"model": MODEL_ID, "revision": MODEL_REVISION, "sha256": hashes}
    (directory / "neuron-provenance.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Local snapshot ready: {directory}")


if __name__ == "__main__":
    main()
