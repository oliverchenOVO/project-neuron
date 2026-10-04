# PHASE STATUS — PHASE 0.5 PASS

Recorded 2026-10-04, Asia/Taipei. All A–W browser milestone gates passed locally.
Phase 1 remains INCOMPLETE. This is a browser instrument displaying previously
computed genuine GPT-2 results. It is not live inference or a desktop release.

## IMPLEMENTED

React 19.3.0, TypeScript 5.9.3, Vite 7.3.6, Zustand 5.0.15, Vitest 3.2.7,
React Testing Library and Playwright 1.63.0; reproducible npm lockfile.
The frontend data-source interface separates fixture acquisition from React.
No inference HTTP backend, Electron, packaging, WebGL or additional model was
added. The Vite server only serves frontend files.

Token strip, global selection/hover, 12-layer rail with disabled EMB, AVG and 12
heads, complete attention heatmap, selected-query arcs, token inspector, genuine
final top-10 probabilities, information dialog and explicit loading/error/retry
states. All controls operate on real fixture data. Selecting `sat` opens ARCS.
Layer, head, token and mode switches retain the original analysis object.

## REAL DATA SOURCE

**GENERATED FROM REAL GPT-2 OUTPUT — NOT MOCK DATA.**

Model: `openai-community/gpt2`, official local safetensors, revision
`607a30d783dfa663caf39e06633721c8d4cfcd7e`; checkpoint SHA-256
`248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707`.
12 blocks × 12 heads, hidden size 768, vocabulary 50,257, 124,439,808 parameters.
Pinned Phase 0 loader, eager attention, eval/inference mode, CPU, offline loading.
Analysis schema **0.1.1**, fixture generator **1.0.0**.

The original 36-test suite was rerun **before UI work**: 36 passed in 25.93 s,
zero skipped. Phase 0 engine code and tests remain unchanged. Final Python
suite: **37 passed in 20.03 s**, including a new real-engine fixture export test
that compares every exported model-derived field with the original result.
The existing suite validates full-vocabulary softmax, actual causal masks, raw
residual magnitude/change, final lens consistency, offline sockets blocked and
the real subprocess worker.

## FIXTURE GENERATION

From the repository root:

```powershell
.\.venv\Scripts\python.exe -B -m scripts.generate_showcase_fixture --verify-reproducibility
```

From `frontend/`: `npm run fixtures` invokes that same generator. A local model
must already be present; missing weights are an error. No fake fallback exists.

| Fixture | Fixed public prompt | Tokens | UTF-8 bytes | SHA-256 |
|---|---|---:|---:|---|
| showcase | `The cat sat on the mat` | 6 | 99,380 | `80dbc75f8214a5a5f5240da60c282e06cb02bca3065c4f8f8854959f20eaea18` |
| stress-64 | ` hello` repeated 64 times | 64 | 8,623,721 | `40be8e8623e816a6781f5a6dde077d4ded0fb5fab5c769c3cf4cf734881423b4` |

Both fixtures were generated twice with the engine cache cleared between
passes. The serialized results were byte-identical in this environment.
Rerunning generation after implementation retained both hashes. Reproducibility
means pinned model/configuration and repeatable same-environment execution;
different Torch versions/CPU kernels can have small numerical differences.

No arbitrary private `artifacts/` file was copied into the frontend. Committed
fixtures use only these two public prompts. The provenance and manifest mark
revision, schema, generator version and non-mock origin. Serialization removes
separator whitespace and machine/timing metadata only; tensors, derived metrics,
probabilities and original numeric precision are untouched. This explains the
8.62 MB fixture versus the prior roughly 9.27 MB spaced JSON measurement; it is
not a tensor compression or protocol/schema rewrite. The analysis wrapper adds
fixture provenance; the underlying engine schema is unchanged.

[Fixture evidence](evidence/fixture-generation.json) records genuine generation
and uncached repeat verification. Single-run engine timings below are separate
from browser measurements; they are not inference latency percentiles:

| Public fixture | Forward incl. tokenizer/checks | Forward + derived analysis | Model load |
|---|---:|---:|---:|
| 6 tokens | 497.90 ms | 577.95 ms | 923.26 ms, once |
| 64 tokens | 139.36 ms | 270.33 ms | resident model |

The six-token request is the first request after loading; first-use Torch/kernel
costs make these two isolated samples unsuitable for comparing sequence-length
scaling. Analysis excludes initial model loading and JSON encoding. The generator
also records generation plus repeat-forward/serialization time separately.

## VISUALIZATIONS

Attention layer 1 maps to `attention_matrices[0]`; Layer 12 to `[11]`.
Representation inspection maps Layer L to raw residual index L, with index 0
being EMB. Magnitude is the L2 norm; change is L2 distance to the preceding raw
stream. The first change is EMB → L01, not an invented attention embedding layer.

AVG = sum of 12 real heads / 12, with no further normalization. Individual heads
use the original matrix references. Means are cached per analysis/layer in a
WeakMap. Canvas draws every N×N cell, X=key and Y=query, including future zeros.
The fixed color function is `sqrt(clamp(w,0,1))` mapped from graphite to cyan.
Six-decimal hover tooltip and persistent keyboard readout identify layer/head,
query, key and weight. Enter selects the query; arrow keys inspect adjacent cells.

SVG arcs show only the selected query's five highest positive legal keys
(`key <= query`), descending weight then position for ties. No selection means
no edges. Width is `0.8 + 7w` px; opacity is `0.2 + 0.8w`. Self-attention is a
loop. Geometry follows token positions and available viewport space, never
random values. Hover gives the exact weight; the inspector supplies a persistent
ordered target list. Global hover links token and visualization highlighting.

Prediction bars use the genuine full-vocabulary probability as a fraction of
100%; they are not divided by the largest candidate or renormalized within
top-k. The backend's full-vocabulary softmax is verified by original Python tests.

Runtime validation checks all fields, versions, dimensions, finite values,
token/ID correspondence, 1–64 tokens, head/layer counts, causal masks, row sums,
probability bounds and ranking. Row-sum tolerance is 1e-5; future-value tolerance
is 1e-6. Actual fixtures have future values exactly zero. Invalid data produces
an explicit error and no substitute numerical visualization.

## FRONTEND TESTS

`cd frontend; npm test`: **29 passed**, one test file. Contract/schema failures,
empty and 65-token data, genuine 64-token acceptance, malformed shapes/NaN,
causal future values and row sums, invalid probability/ranking, AVG math/cache,
individual matrix identity, top-N legal keys, BPE/whitespace display, source
fetch caching, HTTP failure, token rendering/selection, layer/head switches,
large-object identity, exact keyboard cell values, magnitude/change, genuine
probability bars, no-selected-query arcs, information, loading and visible errors.

`npm run build`: strict TypeScript check + production Vite build **PASS**.
Production output: JS approximately 250.37 kB / 79.03 kB gzip; CSS 11.12 kB /
3.05 kB gzip. Fixtures remain separate fetchable assets, not embedded in JS.

## VISUAL REGRESSION

Regular Playwright Chromium was used because the Browser plugin skill was not
available in this session. This also follows the user's explicit Playwright
requirement. Tests use the **production build**, not a development React server.

`npm run test:e2e`: **6 passed in 9.1 s** without snapshot updates. Four existing
1920×1080 baselines compared successfully: default matrix, selected `sat` arcs,
Layer 06 / H04 arcs, and 64-token stress heatmap. Baselines were generated once,
reviewed, deliberately updated for responsive geometry/accurate EMB labeling,
then verified in normal regression mode. Screenshot animations are disabled;
reduced motion, fixed DPR=1, locale=en-US and dark scheme are used. Allowed
different-pixel ratio is 0.001; Playwright's per-pixel comparison is used.

The tests also verify the complete sat → arcs → layer/head → heatmap path,
keyboard future-zero readout, information/Escape, missing fixture/retry,
no browser console/page errors in the main path, and an actual Canvas pixel and
tooltip against the genuine numerical matrix/color mapping. Stress controls
traverse all 12 heads and Layers 01/06/12, select token 63, and assert a single
fixture request. No re-fetch/re-parse occurs on scene interactions.

Actual screenshots:

- [Matrix Hero](screenshots/matrix-hero.png): L01 / AVG, no query selected.
- [Arc Hero](screenshots/arc-hero.png): L01 / AVG, query 2 (` sat`).
- [64-token scene](screenshots/stress64-heatmap.png): L01 / AVG.
- [1440×900](screenshots/desktop-1440.png) and [1280×720](screenshots/desktop-1280.png): sat arcs.

Visual inspection compared these rendered images with the user's scientific
layout requirements and the [design contract](PHASE0_5_DESIGN.md), not with a
fabricated model image. Code-native Canvas/SVG is an intentional exception to
the frontend skill's generated-concept workflow, required by the user's no-cloud
and no-synthetic-visualization instructions.

| Fidelity check | Result |
|---|---|
| Composition | Central analysis panel, narrow layer rail, right inspector, bottom prediction strip |
| Copy | PROJECT NEURON, exact public prompt, SHOWCASE FIXTURE / REAL FORWARD PASS |
| Palette | Graphite background, fixed cyan attention scale, amber selection, violet residual change |
| Typography | Segoe UI labels/body; Consolas numeric/BPE values; consistent compact data hierarchy |
| Data geometry | All heatmap cells, true selected-query edges and a self loop; no decorative network |
| Spacing | Quiet header and token strip; 1 px borders; consistent 12–20 px panel spacing |
| Controls | Layer 12, H12, modes and information remain on-screen in all three viewports |
| Desktop fit | No document overflow at 1920×1080, 1440×900 or 1280×720; inspector can scroll internally |

The 1280×720 SVG initially shrank too far under a fixed aspect ratio. It was
corrected to use measured available width/height, retaining readable token labels.
64-token strips/arcs intentionally scroll horizontally; axis labels are thinned
in the stress heatmap, while all 4,096 cells remain displayed and inspectable.
Mobile layout is outside the requested scope.

## PERFORMANCE

Reproduce with `npm run build`, `npm run preview` in one terminal and
`npm run benchmark` in another. Full samples and machine metadata are committed
in [browser-benchmark.json](evidence/browser-benchmark.json).

Windows 10.0.26200, Intel i9-12900H, 20 logical cores, 47.70 GiB RAM, Node
24.13.0, Chromium 153.0.8010.12, 1920×1080/DPR 1. CPU/GPU conditions on a shared
desktop can vary. Each fixture has 15 fresh-document loads (source cache reset
by navigation; OS/network resource caches may be warm). Median and nearest-rank
p95 are reported; with only 15 loads, p95 is the observed maximum and has limited
statistical confidence. Every metric below is in milliseconds.

| Browser stage | 6-token median / p95 | 64-token median / p95 |
|---|---:|---:|
| Local fixture fetch + response text | 4.90 / 15.90 | 132.50 / 535.30 |
| JSON.parse only | 0.50 / 0.90 | 32.50 / 68.90 |
| Full semantic validation | 0.90 / 4.70 | 12.80 / 23.80 |
| Zustand state initialization | 0.10 / 0.30 | 0.10 / 0.20 |
| Initial meaningful render readiness | 22.90 / 113.20 | 36.50 / 78.20 |

Initial render is measured from state initialization to two requestAnimationFrame
callbacks after ready UI commit/Canvas draw, excluding fetch/parse/validation.
It includes scheduling/state initialization rather than forming another additive
CPU bucket. It is a render/frame-readiness proxy, not physical monitor latency.
Payload-byte UTF-8 accounting and minor surrounding orchestration are not included
in the isolated parse/validation/state measurements. No browser inference time
exists: model execution happened earlier in the Python generator.

Repeated interactions use actual Playwright DOM clicks, with layer/head changes
in the dense HEATMAP path, token selection opening ARCS, and both mode directions.
There are 59 layer changes (initial layer 1 click is a no-op), 60 head changes,
60 token selections and 120 mode changes per fixture. Measurements start in the
Zustand interaction handler and end at React layout commit; the next rAF is
recorded separately. They exclude Playwright transport/actionability overhead.

| Interaction | 6-token JS median / p95 | 64-token JS median / p95 | 64-token next-rAF median / p95 |
|---|---:|---:|---:|
| Layer | 0.80 / 1.60 | 4.10 / 7.90 | 10.30 / 18.80 |
| Head | 0.70 / 1.20 | 4.10 / 8.50 | 10.40 / 14.30 |
| Token | 1.00 / 2.60 | 1.70 / 2.90 | 6.10 / 12.00 |
| Mode | 2.20 / 3.20 | 5.80 / 10.00 | 13.20 / 17.20 |

**Target interaction JS p95 <50 ms: PASS for both fixtures and all four kinds.**
64-token maximum observed next-rAF sample was 27.30 ms. No browser errors or
multi-second interaction stall was observed in this run. These measurements
do not guarantee performance on other hardware.

Profiling shows initial JSON parsing/validation is the main data-load cost, not
state changes. The first measurements already met the interaction target, so
no tensor encoding/protocol precision rewrite was justified. Existing lossless
JSON encoding, cached data acquisition, in-place validation, narrow Zustand
subscriptions, cached head means, memoized fixed panels and Canvas cells keep
the data object stable. The final run above is retained in full rather than
selecting only the fastest run. Initial parse can still briefly occupy the main
thread (68.90 ms observed p95); loading is explicitly labeled.

## 64-TOKEN STRESS RESULT

**PASS.** Genuine fixed public forward-pass output; 64 BPE tokens, 12×12×64×64
attention tensor, 4,096 visible cells in the selected head/mean. All layer/head
controls respond, final-position token selection produces five real legal edges,
inspector remains usable, future triangle is zero, and the full-vocabulary
probability bars remain genuine. One fixture request across interactions, no
re-parsing and no observed renderer freeze during the tested control sequences.
Long token and arc surfaces scroll; data is never truncated for display density.

## ACCEPTANCE GATES

| Gate | Result / evidence |
|---|---|
| A | PASS — original 36 tests before UI; 37 after fixture export test |
| B | PASS — strict TypeScript + Vite production build |
| C | PASS — fixed public prompts through local official GPT-2 engine |
| D | PASS — independent uncached repeats, byte equality and retained hashes |
| E | PASS — exhaustive runtime schema/numerical checks and formal error UI |
| F | PASS — actual BPE sequence, selection, hover, whitespace/ID rendering |
| G | PASS — 12 layer controls, keyboard arrows, stable analysis reference |
| H | PASS — all 12 heads traversed in frontend and stress browser tests |
| I | PASS — arithmetic mean of all 12 genuine matrices, mathematical test |
| J | PASS — real values, exact readout, genuine Canvas pixel test |
| K | PASS — selected-query positive legal top-5 edges, real weights, self loop |
| L | PASS — future zeros retained; exact future-zero keyboard/hover tests |
| M | PASS — raw BPE/ID/position, correct representation index, L2 metrics/targets |
| N | PASS — genuine full-vocabulary softmax, original probability bar widths |
| O | PASS — no mock signal, random graphics or numerical placeholder |
| P | PASS — three six-token fixed snapshots verified without updates |
| Q | PASS — 64-token stress snapshot and interaction path |
| R | PASS — repeated production browser measurements, median/p95/raw samples |
| S | PASS — responsive measured stress interactions, no observed freeze/errors |
| T | PASS — inspected 1920×1080 screenshots plus two smaller desktop sizes |
| U | PASS — 29 frontend tests, 6 Playwright tests |
| V | PASS — existing oliverchenOVO/project-neuron verified private via GitHub |
| W | PASS — no Electron or Phase 1C implementation |

## KNOWN LIMITATIONS

Browser-only, precomputed public fixtures; no editable-prompt inference or worker
connection. Phase 1 is incomplete. Mobile, arbitrary Unicode fixture offset
contracts, cross-platform pixel baselines and low-spec hardware are not accepted
by this milestone. The 64-token public stress prompt is deliberately repetitive
and does not represent every possible semantic/input case.

Initial parse/validation remains synchronous and can briefly block the main
thread; future worker/transport work requires fresh profiling. Benchmark frame
markers are approximations, and browser resource caches/desktop load affect
results. No live Python-to-renderer IPC cost or desktop crash-recovery measurement
has been claimed. Screenshot baselines depend on Chromium and Windows fonts.

PCA and Logit Lens signals are validated in the fixture but have no visualization
here. PCA axes are independently fitted per layer; a shared trajectory is not
established. Lens results are for the last input position and are diagnostic
estimates. Magnitude is not importance; attention alone is not a complete causal
explanation. These limits appear in the information dialog and README.

## GIT

Existing private repository: `oliverchenOVO/project-neuron`, main. Prior Phase 0
commits are retained, without squash. Implementation milestone:
`0052eb4f571b07f1dd9a2f3a69cc2f7555d885c2` —
`feat: add real-data browser microscope`. Validation/report evidence is recorded
in a subsequent milestone. Both are pushed; final working tree cleanliness is
checked after the report commit.

Browser CI for the implementation commit: **PASS**, independently verified at
[run 37181864188](https://github.com/oliverchenOVO/project-neuron/actions/runs/37181864188).
Real-model CI for the same implementation commit: **PASS**, independently
verified at [run 37181864191](https://github.com/oliverchenOVO/project-neuron/actions/runs/37181864191).
It ran the real engine tests and generated two independent uncached public
fixture passes successfully. Local success and push success were not substituted
for remote CI completion. Subsequent report-only commits do not alter this
validated implementation; their own CI status is checked before final handoff.

## NEXT REQUIRED MILESTONE

Phase 1A core analysis views, with explicit handling of independent PCA axes and
last-position lens semantics. Phase 1B Journey/polish follows; Electron worker
supervision is Phase 1C and Windows distribution is Phase 1D. No later milestone
work was begun as part of Phase 0.5.
