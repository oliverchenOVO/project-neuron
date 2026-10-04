# Project NEURON — AI Neural Network Microscope

Make the invisible internal signals of a Transformer visible.

An instrument for observing **real local GPT-2 forward passes**, not a chatbot.
Current milestone: Phase 1A, Microscope Core. The complete desktop Phase 1 remains incomplete.
No simulated model data or fabricated progress is used.

**Phase 0 passed:** real CPU/offline GPT-2 forward pass and worker
roundtrip verified. See [validation evidence](docs/PHASE0_VALIDATION.md) and the
[Phase 1 acceptance ledger](docs/PHASE1_VALIDATION.md) for exact scope and limits.

## Browser microscope

React + TypeScript + Vite + Zustand. The browser displays **SHOWCASE FIXTURE /
REAL FORWARD PASS**: previously computed local GPT-2 signals, with strict schema
validation. **GENERATED FROM REAL GPT-2 OUTPUT — NOT MOCK DATA.** It does not run
inference in the browser. No backend inference HTTP service is involved.

```powershell
cd frontend
npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. Select **sat**, choose **SIMILARITY**, and change
Layers 01 → 06 → 12 to inspect genuine signed cosine relationships. Switch to
**SPACE**, select Layer 06, and turn **TRAIL ON** to see EMB → L12 in one shared
PCA basis with fixed axes. **COMPARE** defaults to L03 → L09 and displays full
hidden-space L2/cosine, magnitudes and shared projected coordinates.

**ATTENTION** preserves heatmap/arcs and AVG / H01–H12; heads affect attention only.
HEATMAP retains all query/key cells, including future zeros. Arrow keys on the
matrix inspect exact values; Enter selects its query. Up/down elsewhere changes
layer. Use the fixture menu for the 64-token stress scene.

Phase 1A hero: 1920×1080, `The cat sat on the mat`, selected **sat**, SPACE,
Layer 06, TRAIL ON. An actual production-browser screenshot:

![Shared-space trail hero](docs/screenshots/phase1a-trail-hero.png)

Second hero: selected **sat**, SIMILARITY, Layer 06. Every cell and ranking
comes from genuine raw hidden-state cosine; self is excluded from ranking.

![Similarity hero](docs/screenshots/phase1a-similarity-matrix.png)

The [original Matrix Hero](docs/screenshots/matrix-hero.png) and
[Arc Hero](docs/screenshots/arc-hero.png), old evidence and four old snapshot
baselines remain unchanged. `/?legacy=1` reproduces the Phase 0.5 frame using
archived schema 0.1.1 fixtures. The default route uses schema 0.2.0.

Reproduce public fixtures with the existing local checkpoint:

```powershell
.\.venv\Scripts\python.exe -B -m scripts.generate_showcase_fixture --verify-reproducibility
# Equivalent from frontend/: npm run fixtures
cd frontend
npm test
npx playwright install chromium
npm run test:e2e
# Start npm run preview in another terminal, then:
npm run benchmark:core
```

Fixed public prompts only: the six-token smoke sentence and ` hello` repeated
64 times. Revision/schema/generator version and SHA-256 are recorded in
`frontend/public/fixtures/manifest.json`. No model-derived numbers are rounded or
edited. Compact JSON separators omit whitespace; only machine/timing metadata
is omitted. Private prompt-derived `artifacts/` remain ignored.

See [Phase 1A validation](docs/PHASE1A_VALIDATION.md) for all A–AC gates,
screenshots, separate engine/browser costs, reproducibility and completed CI.
[Phase 0.5 validation](docs/PHASE0_5_VALIDATION.md) preserves the prior evidence. Baseline updates
are deliberate: `npm run test:visual:update`; normal verification never updates
snapshots. Windows screenshot baselines are tied to the recorded Chromium/font
environment.

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

Implemented: CLI / JSON-line worker → Python analysis engine → resident GPT-2;
public fixture generator → browser data-source abstraction → React renderer.
Planned live integration: renderer → Electron preload →
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
2D projection. SPACE uses one globally centered shared basis fitted to all 13
representation layers/tokens and fixed padded domains; the original independent
per-layer coordinates remain separate. Explained variance is displayed. Final
Prediction uses final logits and a full-vocabulary softmax. Logit Lens Estimate
projects intermediate residual streams through GPT-2's final normalization and
LM head, using the final input position.

## What they do not mean

Attention weights should not automatically be read as a complete explanation of
why GPT-2 produced an output. Hidden similarity and PCA are analytical views of
internal vectors, not consciousness, semantic certainty or complete embedding
space. Magnitude is not importance. Logit Lens is a diagnostic projection, not
GPT-2's actual intermediate prediction process. The original per-layer PCA field has independent axes. SPACE uses the new shared
basis; TRAIL shows successive projected representations, not a causal reasoning
path. Two dimensions lose information, and raw PCA can be dominated by large
residual magnitudes. No semantic meanings are assigned to PC1 or PC2.

## Windows builds and screenshots

**Windows executables are not available at Phase 1A.** Phase 1D will freeze `neuron-engine.exe` using
PyInstaller, bundle local weights, then use electron-builder for Windows x64
NSIS and portable builds. End users must not need Python, Node or model libraries.
Installers cannot be claimed complete until packaged offline/crash-recovery QA
passes. Browser screenshots and Playwright visual regressions are now available.

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
