"""Optional standard-library ranged download of the pinned official checkpoint.

Checks every range and the upstream LFS SHA-256 before publishing the file.
Useful on connections with a low per-stream download rate.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import urllib.request

from engine.config import MODEL_ID as MODEL, MODEL_REVISION as REVISION


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="resources/models/gpt2")
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()
    if not 1 <= args.workers <= 16:
        parser.error("workers must be between 1 and 16")
    folder = Path(args.output).resolve()
    folder.mkdir(parents=True, exist_ok=True)
    api = f"https://huggingface.co/api/models/{MODEL}/revision/{REVISION}?blobs=true"
    with urllib.request.urlopen(api, timeout=60) as response:
        metadata = json.load(response)
    entry = next(f for f in metadata["siblings"] if f["rfilename"] == "model.safetensors")
    size, expected = entry["lfs"]["size"], entry["lfs"]["sha256"]
    target = folder / "model.safetensors"
    if target.is_file() and target.stat().st_size == size and sha256(target) == expected:
        print("Verified checkpoint already present.", flush=True)
        return
    partial = folder / "model.safetensors.partial"
    if target.is_file():
        if partial.exists():
            raise RuntimeError("Both incomplete checkpoint and partial exist; preserve and inspect them.")
        target.replace(partial)
    offset = partial.stat().st_size if partial.exists() else 0
    if offset > size:
        raise RuntimeError("Partial checkpoint exceeds upstream size.")
    stride = 4 * 1024 * 1024
    segments = [(i, start, min(start + stride, size) - 1)
                for i, start in enumerate(range(offset, size, stride))]

    def download(segment):
        index, start, end = segment
        part = folder / f"checkpoint-range-{index}.part"
        url = f"https://huggingface.co/{MODEL}/resolve/{REVISION}/model.safetensors?neuron_range={index}"
        expected_range = f"bytes {start}-{end}/{size}"
        if shutil.which("curl.exe"):
            headers = folder / f"checkpoint-range-{index}.headers"
            subprocess.run(["curl.exe", "--fail", "--location", "--silent", "--show-error",
                            "--retry", "2", "--max-time", "180", "--range", f"{start}-{end}",
                            "--dump-header", str(headers), "--output", str(part), url], check=True)
            received = [line.partition(":")[2].strip() for line in
                        headers.read_text(encoding="utf-8").splitlines()
                        if line.lower().startswith("content-range:")]
            if not received or received[-1] != expected_range:
                raise RuntimeError(f"Server returned an incorrect byte range for segment {index}.")
            headers.unlink()
        else:
            request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
            with urllib.request.urlopen(request, timeout=120) as response:
                if response.status != 206 or response.headers.get("Content-Range") != expected_range:
                    raise RuntimeError(f"Server returned an incorrect byte range for segment {index}.")
                with part.open("wb") as handle:
                    shutil.copyfileobj(response, handle, 1024 * 1024)
        if part.stat().st_size != end - start + 1:
            raise RuntimeError(f"Incomplete segment {index}.")
        print(f"Range {index + 1}/{len(segments)} complete.", flush=True)
        return part

    parts = {}
    print(f"Downloading {size-offset:,} remaining bytes in {len(segments)} ranges across {args.workers} streams.", flush=True)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(download, s): s[0] for s in segments}
        for future in as_completed(futures):
            parts[futures[future]] = future.result()
    assembled = folder / "model.safetensors.assembling"
    with assembled.open("wb") as handle:
        for part in ([partial] if partial.exists() else []) + [parts[i] for i in sorted(parts)]:
            with part.open("rb") as source:
                shutil.copyfileobj(source, handle, 1024 * 1024)
    if assembled.stat().st_size != size or sha256(assembled) != expected:
        raise RuntimeError("Official checkpoint SHA-256 mismatch; file has not been published.")
    assembled.replace(target)
    for part in list(parts.values()) + ([partial] if partial.exists() else []):
        part.unlink()
    print(f"Verified official checkpoint SHA-256: {expected}", flush=True)


if __name__ == "__main__":
    main()
