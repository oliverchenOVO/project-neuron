# Phase 0 — PASS

Validated locally on 2026-10-04 (Asia/Taipei). **PHASE 1 INCOMPLETE.**
This report describes the Python real-data spike only; no frontend or installer
is claimed complete.

## Model and environment

- Official `openai-community/gpt2` safetensors checkpoint.
- Revision: `607a30d783dfa663caf39e06633721c8d4cfcd7e`.
- Checkpoint SHA-256 verified against upstream LFS:
  `248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707`.
- Checkpoint size: 548,105,171 bytes. Local directory: `resources/models/gpt2/`.
- Parameters: 124,439,808. Blocks: 12. Heads per block: 12. Hidden dimension: 768.
- Windows 11 build 26200, Python 3.12.10, PyTorch 2.14.1+cpu,
  Transformers 4.57.6, NumPy 2.5.3, pytest 8.4.2; four CPU threads.
- Model inference: float32, eval mode, eager attention, inference_mode.
  Probability normalization: float64 over the full vocabulary.
- Analysis schema/version: 0.1.1. Exact dependencies: `requirements-cpu.lock`.
- `pip check`: no broken requirements found.

## Real forward-pass smoke test

Input: `The cat sat on the mat`

Tokens: `The`, `Ġcat`, `Ġsat`, `Ġon`, `Ġthe`, `Ġmat`.

IDs: `[464, 3797, 3332, 319, 262, 2603]`.

| Signal | Observed shape/count |
|---|---|
| Word embeddings | `[1, 6, 768]` |
| Position embeddings | `[1, 6, 768]` |
| HF hidden states | 13 × `[1, 6, 768]` |
| Raw residual-stream representations | 13 × `[6, 768]` |
| Attention | 12 × `[1, 12, 6, 6]` |
| Final logits | `[1, 6, 50257]` |
| Cosine similarity | 13 × `[6, 6]` |
| PCA coordinates | 13 × `[6, 2]` |
| Logit Lens ranking | 13 × top-10, last input position |

Top final predictions after float64 softmax normalization:

| Token | Probability |
|---|---:|
| `,` | 23.700908% |
| ` and` | 14.987944% |
| ` with` | 7.134079% |
| `.` | 6.309218% |
| ` in` | 5.880389% |
| ` for` | 4.987881% |
| ` as` | 3.310348% |
| ` while` | 2.645570% |
| ` of` | 1.962783% |
| ` next` | 1.646009% |

Local evidence: `artifacts/phase0-analysis.json`, `artifacts/phase0-smoke.txt`,
`artifacts/phase0-evidence.json`, `artifacts/pytest.xml`,
`artifacts/environment.json`. These are deliberately excluded from Git because
analysis artifacts may contain private prompt-derived data. Fixed smoke inputs
and scripts reproduce the results; no display fixture uses synthetic weights.

## Tests — 36 passed

Final run: `36 passed in 50.62s` with no skips. Includes:

- Deterministic real BPE IDs and Unicode complete-sequence roundtrip.
- Word-plus-position embedding equality and every hidden-state shape.
- Every attention layer/head shape, nonnegative weights, row sums near one,
  and zero attention to future positions.
- Finite real final logits, full-vocabulary softmax normalization and rankings.
- Cosine diagonal near one, matrix symmetry and zero-vector convention.
- PCA finite coordinates/variance, centered output and degenerate inputs.
- Finite intermediate lens logits; final normalization and LM head match final
  logits within FP32 tolerance; diagnostic and final ranking IDs agree.
- Exact L2 magnitude/delta formulas, bounded JSON, resident model identity,
  cache key separation and client mutation safety.
- Empty/invalid input, 65-token rejection, exact 64-token boundary,
  one-token full analysis, top-k bounds and missing local model.
- Malformed RPC requests, ping/status/shutdown, actual Python subprocess →
  pretrained model → JSON response.
- Fresh local model load and analysis with Python socket connections blocked.

Initial validation exposed float32 softmax accumulation error (~1.8e-5 for
50,257 entries). The engine now normalizes genuine model logits in float64.
FP32 GEMV/GEMM paths also cause small diagnostic projection differences; lens
probabilities are compared with 1e-5 absolute tolerance, while logits and ranking
IDs are checked separately. This fixes numeric handling rather than replacing
model signals or suppressing failed tests.

## Performance — local observations, not a statistical benchmark

| Input length | Forward + tokenization | Full engine analysis | Cached request | Compact UTF-8 JSON |
|---|---:|---:|---:|---:|
| 6 tokens | 468.0 ms | 593.2 ms | 5.7 ms | 106,581 bytes |
| 64 tokens | 459.7 ms | 2,425.7 ms | 428.3 ms | 9,271,693 bytes |

Fresh model object loading after Python imports: 1,145.8 ms. OS file caches may
be warm. This is **not full application startup time**. Engine timings exclude
JSON encoding, IPC, renderer work and model loading. The 64-token case follows
the 6-token case in one resident process. Results vary by hardware and cache.

At 64 tokens: maximum attention row-sum error 4.77e-7; future attention exactly
zero; maximum cosine diagonal error 7.15e-7; symmetry error zero.

## Implemented scope and limitations

Real tensor extraction and all required derived metrics are implemented. Raw
hidden vectors remain in Python; JSON transfers presentation metrics, actual
attention matrices and diagnostic rankings. Maximum context is 64 tokens and
the result cache is an eight-entry in-memory LRU.

The maximum-length JSON is ~9.27 MB. This is bounded but warrants transfer and
renderer profiling in Phase 1C. Logit Lens currently uses the last prompt
position. Token-specific journey diagnostics may require an explicit extension.
PCA axes are independent per layer, so interpolated movement is not a shared
coordinate-system trajectory.

The RPC worker is sequential and lazy-loads its model. It cannot answer status
while loading/analyzing. Live startup events, Electron supervision, timeouts,
malformed-response handling and worker crash recovery remain Phase 1C work.

## Next required milestone

Phase 0.5: browser visualization of these verified outputs, followed by the
microscope core. Formal UI was not started before this real-data gate passed.
