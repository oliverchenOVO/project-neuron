# Project NEURON — AI Neural Network Microscope

Make the invisible internal signals of a Transformer visible.

An instrument for observing **real local GPT-2 forward passes**, not a chatbot.
Current milestone: Phase 0, Python analysis spike. Phase 1 is incomplete.
No simulated model data or fabricated progress is used.

**Phase 0 passed:** 36 local tests, real CPU/offline GPT-2 forward pass and worker
roundtrip verified. See [validation evidence](docs/PHASE0_VALIDATION.md) and the
[Phase 1 acceptance ledger](docs/PHASE1_VALIDATION.md) for exact scope and limits.

## Run on Windows (PowerShell)

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --no-compile torch --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install --no-compile -e ".[dev]"
.\.venv\Scripts\python.exe -m scripts.download_model
.\.venv\Scripts\python.exe -m engine.cli --model-dir resources/models/gpt2 --offline
```

The smoke prompt is `The cat sat on the mat`. The command prints actual tokens,
IDs, all tensor shapes and top-10 next-token predictions. Machine-readable output
is saved to `artifacts/phase0-analysis.json`. Supply another prompt as the first
argument. Inputs above 64 tokens fail explicitly; they are never truncated.

First-time setup requires internet to install dependencies and download the
official weights. Subsequent inference with `--model-dir` is local-only.
Without a model directory, development uses Hugging Face's cache and the pinned
revision, with network downloads allowed unless `--offline` is set. Missing
offline weights produce a structured error, never fake data.

To reproduce the exact Windows/Python 3.12 CPU dependency versions used in
validation, install `requirements-cpu.lock` with `pip install --no-compile -r
requirements-cpu.lock`, then install this project with `pip install --no-deps -e
".[dev]"`. The lock includes the official PyTorch CPU wheel index.

## Tests and evidence

```powershell
.\.venv\Scripts\python.exe -m pytest -q --junitxml=artifacts/pytest.xml
.\.venv\Scripts\python.exe -m scripts.validate_phase0
```

Real-model tests require the downloaded checkpoint. They do not skip silently or
substitute random weights. Tests cover tokenizer determinism, embeddings, hidden
and attention shapes, attention normalization, causal future mask, full-vocabulary
softmax, cosine symmetry/self-similarity, finite PCA, lens consistency, cache,
input bounds, offline loading with network blocked and subprocess RPC. Metrics
edge cases use explicitly constructed mathematical tensors, not display data.
The validation command measures fresh model loading after Python imports (the
OS file cache may be warm), 6-token and 64-token CPU
analysis, cache latency, payload size and numerical errors. Hardware-dependent
results go to `artifacts/phase0-evidence.json`.

GitHub Actions also runs these checks on Windows; remote CI completion must be
checked separately from local test results.

## Architecture

Implemented: CLI / JSON-line worker → Python analysis engine → resident GPT-2.
Planned: React + TypeScript + Vite + Zustand renderer → Electron preload →
Electron main process → frozen Python worker. Phase 1 uses no inference HTTP
server, and renderer code must never execute shell commands.

See [architecture and mathematical definitions](docs/ARCHITECTURE.md) and the
[original project specification](docs/PROJECT_SPEC.md). The engine modules separate
model loading, tokenization, inference, attention, hidden-state metrics, cosine
similarity, PCA, prediction and RPC.

## Model and offline storage

Only `openai-community/gpt2` is supported: 12 blocks, 12 heads, 768-dimensional
representations, 50,257 vocabulary entries. We use eager attention and eval mode.
Revision: `607a30d783dfa663caf39e06633721c8d4cfcd7e`. The download command
creates `resources/models/gpt2/`, plus a SHA-256 provenance manifest. Weights,
virtual environment and prompt-derived artifacts are excluded from Git.

On slow per-stream connections, optionally run `py -3.12 -m scripts.download_checkpoint`
before `scripts.download_model`. It downloads small validated byte ranges in
parallel and checks the assembled file against the upstream LFS SHA-256. The
regular Hugging Face download then fills in tokenizer/config files and provenance.
This helper is a development download tool, not part of inference or the renderer.

The local directory is the future bundled resource source. Production packaging
must include it and pass that exact resource path to the worker. Model licensing
notices must accompany distribution. The model is not uploaded to this source
repository.

## What the visualizations mean

Representation Magnitude is an L2 norm; Representation Change is an L2 distance
from the preceding layer. Similarity is pairwise cosine similarity. Attention
matrices are actual attention weights indexed by query/key position. PCA is a
2D projection; explained variance and independent axes are recorded. Final
Prediction uses final logits and a full-vocabulary softmax. Logit Lens Estimate
projects intermediate residual streams through GPT-2's final normalization and
LM head, using the final input position.

## What they do not mean

Attention weights should not automatically be read as a complete explanation of
why GPT-2 produced an output. Hidden similarity and PCA are analytical views of
internal vectors, not consciousness, semantic certainty or complete embedding
space. Magnitude is not importance. Logit Lens is a diagnostic projection, not
GPT-2's actual intermediate prediction process. PCA coordinates have independent
axes at each layer; interpolated motion is not proof of a shared-space trajectory.

## Windows builds and screenshots

**Not available at Phase 0.** Phase 1D will freeze `neuron-engine.exe` using
PyInstaller, bundle local weights, then use electron-builder for Windows x64
NSIS and portable builds. End users must not need Python, Node or model libraries.
Installers cannot be claimed complete until packaged offline/crash-recovery QA
passes. UI screenshots and Playwright visual regressions begin after Phase 0.

## Privacy

All inference is local. No prompts are sent to a hosted inference service.
Model setup downloads public model files from Hugging Face. The in-memory cache
retains up to eight prompt-derived results until process exit. CLI analysis JSON
contains tokens and internal signals, so treat it as private prompt-derived data.
There is no telemetry, user account or cloud database.

## Development order

Phase 0 real data → 0.5 browser visualization → 1A microscope core → 1B Journey
and showcase polish → 1C Electron worker integration → 1D Windows packaging/QA.
The Phase 1 acceptance gates remain open until independently verified.
