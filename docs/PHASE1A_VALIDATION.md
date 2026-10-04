# PHASE 1A VALIDATION — CI PENDING

Recorded 2026-10-04, Asia/Taipei. Local gates pass. Functional milestone
`40f84dc` passed Engine and Browser CI; the final validation commit must also
complete CI before Phase 1A is declared PASS. Complete desktop Phase 1 remains
INCOMPLETE.

## IMPLEMENTED

ATTENTION / SIMILARITY / SPACE / COMPARE share selected token, layer and hover.
Selection preserves the large analysis object reference. Head selection affects
attention only, is disabled/subdued elsewhere and is retained when returning.
Original heatmap, causal arcs, AVG, inspector and final next-token probabilities
remain. EMB has no attention matrix: switching to ATTENTION preserves EMB and
explicitly asks for L01–12.

Inspector magnitude and change profiles use 13 genuine magnitudes and 12 genuine
adjacent L2 changes. SVG titles, focusable change bars and a persistent layer
selector expose exact values; EMB change is N/A. No editable inference, new model,
autoplay, Cinematic, full Journey, Logit Lens visualization, Electron, live worker
wiring, inference HTTP service or Windows packaging was added.

## SCHEMA CHANGES

Analysis 0.2.0, fixture generator 1.1.0 adds:

- `shared_pca`: global_pca, all_layers_all_tokens, two components,
  global_feature_mean centering, fit sample count, padding fraction 0.08,
  two variance ratios, fixed axis domains, coordinates `[13,tokens,2]`.
- `same_token_layer_similarity`: signed cosine `[tokens,13,13]`.
- `same_token_layer_distance`: full hidden-space L2 `[tokens,13,13]`.

Old per-layer PCA fields retain independent-fit semantics. All 13 common derived
fields match the original fixtures exactly for BOTH public prompts, including
attention, predictions, magnitude/change, hidden cosine and old PCA.
Strict frontend validation accepts archived 0.1.1 and core 0.2.0; it rejects wrong
versions, dimensions, finite/range/variance/domain violations, incorrect cross-layer
symmetry/diagonals and inconsistent adjacent distance. Raw 768-dimensional vectors,
mean and fitted component vectors stay in Python.

## SHARED PCA METHODOLOGY

Stack EMB and raw post-block residual L01–12 BEFORE `ln_f`, flatten
`[13*tokens,768]`, convert CPU float64 and subtract ONE feature-wise global mean.
One symmetric eigendecomposition solves the smaller sample Gram/feature covariance
matrix. Recover the two normalized feature directions, canonicalize signs by each
largest absolute loading, and transform EVERY layer with the SAME
`(h-global_mean) @ components.T`. No standardizing, whitening, random fitting,
per-layer refit or browser fitting. Ratios divide eigenvalues by total centered
squared energy. Rank-deficient axes are zero padded.

Domains cover all projected layers/tokens with 8% padding per side; constant axes
use finite half-unit bounds. Domains remain fixed across layer/token switching.
Responsive SVG mapping changes display pixels only. Labels can move with leader
lines; scientific points never receive layout displacement.

The initial full SVD prototype was replaced following a 64-token cost investigation.
Tests compare BOTH symmetric solver branches against full SVD within float64
tolerances. Real-model checks validate global mean, orthonormal components and
every layer's transform. Gram/covariance squares conditioning; float64 and rank
tolerance limit near-zero directions. Repeated eigenvalues can yield non-unique
axes: reproducibility is verified for the pinned runtime, not promised bitwise
across numerical libraries. This is a Torch implementation, not a scikit-learn call.
Method references: [Torch SVD](https://docs.pytorch.org/docs/stable/generated/torch.linalg.svd)
and [PCA centering/solvers](https://scikit-learn.org/1.7/modules/generated/sklearn.decomposition.PCA.html).

## CROSS-LAYER SIMILARITY

For each token, compare all 13 raw vectors directly in 768 dimensions. Cosine uses
normalized vectors, epsilon 1e-12, and numerical [-1,1] clamping; zero-vector
cosine is zero. L2 uses direct Euclidean distance, never projected 2D displacement.
Both matrices are symmetric; real cosine diagonals are approximately one and L2
diagonals exactly zero. Adjacent L2 agrees with representation_delta within 1e-5.
Direct raw-vector checks include sat L03 → L09.

## REAL DATA VALIDATION

Official openai-community/gpt2, revision
`607a30d783dfa663caf39e06633721c8d4cfcd7e`, weights SHA-256
`248dfc3911869ec493c76e65bf2fcf7f615828b0254c12b473182f0f81d3a707`.
12 blocks, 12 heads, hidden 768, vocab 50,257, parameters 124,439,808.
Python 3.12.10, Torch 2.14.1+cpu, Transformers 4.57.6; local offline checkpoint,
eval and inference_mode. No model-derived numbers were invented, manually edited,
rounded or moved. Mathematical edge-case tensors occur only in identified tests,
never display data. There is no random model/fallback.

## FIXTURE REPRODUCIBILITY

Independent uncached forwards were serialized twice per fixed public prompt and
complete canonical bytes compared. Only volatile machine/path/timing metadata is
omitted. All numeric output remains genuine. Revision/schema/generator/hash
provenance is in the manifest and [generation evidence](evidence/phase1a-fixture-generation.json).
Original 0.1.1 fixtures are archived with unchanged hashes.

| Fixture | Before bytes | After bytes | Delta bytes | Delta percent |
|---|---:|---:|---:|---:|
| showcase | 99,380 | 139,283 | +39,903 | +40.15% |
| stress-64 | 8,623,721 | 9,042,891 | +419,170 | +4.86% |

- showcase old: `80dbc75f8214a5a5f5240da60c282e06cb02bca3065c4f8f8854959f20eaea18`; new: `0f006a8b315ce22ba14eaeedc2b1337078fe9fe70f0daa4607e198db03f171e8`.
- stress-64 old: `40be8e8623e816a6781f5a6dde077d4ded0fb5fab5c769c3cf4cf734881423b4`; new: `498f1c185af8aef8e4ba765a97dbbd18affde7eeb143d6a05f2a4879387d61d9`.

Engine benchmark JSON has different metadata from canonical public fixtures;
its byte size is not the fixture file size. Private artifacts, weights and
environments remain ignored. [Public comparison evidence](evidence/phase1a-validation.json)
records exact equality of all original derived fields for both fixtures.

## SIMILARITY VIEW

Canvas reads the complete real `hidden_similarity[layer]` with fixed signed
[-1,0,+1] violet/graphite/cyan divergence. Pointer and keyboard readouts expose
source, target, layer and six-decimal cosine. Ranking excludes self and sorts raw
cosine descending, including negatives. Graph angles follow token order; radius
`100 + 78*(1-clamp(cos,-1,1))/2` is bounded and monotonic. Negative edges are
violet/dashed. No random/force layout or attention substitute. Radius encodes a
relationship, not physical hidden-space distance. A test-only negative harness
checks signed Canvas color/readout; it never replaces the real fixtures.

## REPRESENTATION SPACE

SPACE exclusively uses shared coordinates. Actual PC1/PC2 variance:
six-token 97.8917% / 1.1047%; 64-token 80.8410% / 15.2329%.
Manual rail/scrubber includes EMB. Layer changes use 240ms linear interpolation
between genuine endpoints, with fraction clamped [0,1]; reduced motion displays
the exact target immediately. Fixed axis domains never autoscale per layer.
All 64 nodes exist; sparse labels, token selector and full numeric list expose
every token even when projections overlap.

## REPRESENTATION TRAIL

13 exact shared positions ordered EMB → L01 → … → L12. Trail and Info explicitly
state that projected changes are NOT a causal reasoning path. Hover exposes
layer, PC1/PC2, magnitude and preceding change; EMB is N/A. Old independent
per-layer PCA coordinates are never joined into this trail.

## COMPARE MODE

FROM/TO cover EMB–L12. Default sat L03 → L09: magnitude 70.156593 → 144.412888,
delta +74.256294, full-space L2 101.120283, cosine 0.767492. The two actual shared
PCA positions and connecting segment accompany these metrics. Projected 2D
displacement is not substituted for L2. Token Evolution Matrix exposes all 13×13
cosine cells with exact titles.

## TESTS

BEFORE adding features, regression gate passed original Python 37, frontend 29,
Playwright 6 and production build. Final local results:

| Suite | Result | Scope |
|---|---|---|
| Python | 50 PASS, zero skip/failure, 13.48s | genuine model/RPC + shared basis and cross-layer metrics |
| Frontend | 57 PASS | original 29 + 28 core; strict schemas, negative scale, selection identity and values |
| Playwright | 11 PASS, 20.4s | original 6 + 5 core; normal run WITHOUT snapshot updates |
| Production | PASS | strict TypeScript, Vite 44 modules; JS 279.05kB / gzip 86.76kB |

New coverage includes genuine shared transforms/domains, finite variance,
degenerate/single-token/rank-one cases, symmetric solver vs SVD, cross-layer
symmetry/diagonals/direct values/adjacent consistency, uncached fixture repeats,
signed ranking/scale, mode selection retention, head-only attention, profiles,
COMPARE values, fixed axes, 64-node selection and exact motion endpoints.
Real tests require weights and never silently skip. Local ignored artifacts contain
JUnit and Playwright detailed output; public counts/hashes are in validation JSON.

## VISUAL REGRESSION

Browser plugin not available; existing production Playwright workflow used.
Windows Chromium 153.0.8010.12, 1920×1080 DPR1, dark mode, reduced motion.
Six NEW baselines were deliberately created. All four OLD PNG baselines are
byte-identical to commit `192d12d` and pass via `?legacy=1` / archived 0.1.1.
Original heroes and performance evidence remain unchanged.

Actual screenshots reviewed:

- [Similarity matrix](screenshots/phase1a-similarity-matrix.png)
- [Similarity graph](screenshots/phase1a-similarity-graph.png)
- [Shared PCA space](screenshots/phase1a-shared-space.png)
- [Hero: sat, SPACE L06, TRAIL ON](screenshots/phase1a-trail-hero.png)
- [Compare L03 → L09](screenshots/phase1a-compare.png)
- [64-token space](screenshots/phase1a-space64.png)
- [1440×900](screenshots/phase1a-desktop-1440.png), [1280×720](screenshots/phase1a-desktop-1280.png)

Ranking rows were checked visibly, not just for DOM presence. Small desktop
inspectors scroll internally; main controls/predictions fit without document
overflow. Responsive SPACE keeps text in pixel units. Dense raw-PCA clusters
are genuine and remain; selectors provide precise inspection.

## PERFORMANCE

i9-12900H, 20 logical cores, 47.70GiB RAM, Windows 10.0.26200, Node v24.13.0.
Production preview at localhost; no inference HTTP. Hardware observations,
not guarantees for other machines. Engine and browser benchmarks ran separately.

### Engine before / after / delta

One resident pinned CPU model, four Torch threads, two warmups per pipeline,
seven paired UNCACHED requests per public prompt with alternating order.
Before executes exact analysis code from `192d12d`; after uses final symmetric
shared PCA. Relevant old math remains unchanged. Loading is separate, after
imports: 714.02ms; OS cache may be warm. All raw samples retained.
Forward includes tokenization/tensor checks. Derived = analysis minus forward,
including tensor work and list materialization. Analysis excludes model loading,
JSON encoding, IPC/UI. Wall request also includes cache deep-copy. Serialization
separately measures JSON encoding plus UTF-8 bytes. Component medians need not
sum to the median total.

| Fixture | Millisecond metric | Before median | After median | Delta |
|---|---|---:|---:|---:|
| showcase | forward_ms | 131.71 | 144.22 | +12.51 |
| showcase | derived_ms | 182.39 | 194.86 | +12.47 |
| showcase | analysis_ms | 314.11 | 370.43 | +56.32 |
| showcase | request_ms | 321.21 | 376.80 | +55.58 |
| showcase | serialization_ms | 4.63 | 7.08 | +2.46 |
| stress-64 | forward_ms | 274.09 | 366.63 | +92.54 |
| stress-64 | derived_ms | 260.62 | 494.33 | +233.72 |
| stress-64 | analysis_ms | 534.70 | 1086.48 | +551.78 |
| stress-64 | request_ms | 946.53 | 1513.55 | +567.02 |
| stress-64 | serialization_ms | 400.21 | 540.95 | +140.74 |

Direct new shared/cross metrics median: six-token 9.18ms; 64-token 196.68ms.
Total 64-token analysis increases by 551.78ms; derived increases by 233.72ms.
Identical forward code also varies with scheduling, so total delta cannot all
be attributed to PCA. Initial SVD prototype timings are excluded from final
evidence. [Paired engine samples](evidence/phase1a-engine-benchmark.json).

### Browser loading stages

15 fresh documents per fixture; browser HTTP cache may be warm. Fetch includes
response text; parse is JSON.parse; validation is strict schema; state is Zustand
assignment. FirstRender = state assignment → two rAF callbacks, excluding fetch,
parse and validation. It is not monitor presentation latency. With 15 samples,
nearest-rank p95 is maximum; slow loads are included rather than discarded.

| Fixture | Stage | Median ms | p95 ms |
|---|---|---:|---:|
| showcase | fetchMs | 5.80 | 16.30 |
| showcase | parseMs | 0.70 | 1.60 |
| showcase | validationMs | 1.60 | 15.40 |
| showcase | stateMs | 0.10 | 0.20 |
| showcase | firstRenderMs | 26.70 | 120.50 |
| stress-64 | fetchMs | 97.90 | 523.40 |
| stress-64 | parseMs | 31.20 | 38.10 |
| stress-64 | validationMs | 12.90 | 16.80 |
| stress-64 | stateMs | 0.10 | 0.20 |
| stress-64 | firstRenderMs | 31.60 | 42.40 |

### Browser interactions

Actual DOM operations, approximately 60 changes per kind per fixture (same-layer
no-op excluded). JS = handler → React layout commit, target p95 <50ms. Next rAF
readiness is separate. Selection retains the object instead of cloning/refetching.

| Fixture | Kind | Samples | JS median | JS p95 | Next rAF median | Next rAF p95 |
|---|---|---:|---:|---:|---:|---:|
| showcase | similarity-layer | 59 | 1.50 | 2.70 | 5.50 | 11.50 |
| showcase | space-layer | 60 | 1.40 | 2.20 | 10.00 | 13.00 |
| showcase | trail-token | 60 | 1.80 | 2.70 | 5.20 | 10.40 |
| showcase | compare-layer | 60 | 1.40 | 1.60 | 5.50 | 8.70 |
| showcase | microscope-mode | 63 | 6.80 | 12.10 | 10.80 | 15.40 |
| stress-64 | similarity-layer | 59 | 8.00 | 10.80 | 15.40 | 20.00 |
| stress-64 | space-layer | 60 | 1.80 | 2.30 | 11.00 | 12.50 |
| stress-64 | trail-token | 60 | 2.80 | 3.50 | 5.60 | 8.20 |
| stress-64 | compare-layer | 60 | 1.20 | 1.50 | 4.20 | 9.20 |
| stress-64 | microscope-mode | 63 | 7.00 | 10.90 | 12.50 | 20.00 |

All five required kinds satisfy p95 <50ms for both fixtures; zero page errors.
[Complete raw browser measurements](evidence/phase1a-browser-benchmark.json).

### Animation frame timing

16 normal-motion manual layer changes. Measure consecutive rAF timestamps ONLY;
handler → first rAF is excluded because its timestamp can precede the handler.
Interpolation clamps to [0,1] to avoid first-frame extrapolation. Callback work
measures interpolation/setState scheduling, excluding subsequent React render
and paint; it is not total-frame CPU time. Endpoints/reduced motion are E2E tested.

| Fixture | Frames | Interval median | Interval p95 | Callback median | Callback p95 |
|---|---:|---:|---:|---:|---:|
| showcase | 225 | 16.70 | 16.73 | 0.00 | 0.10 |
| stress-64 | 228 | 16.70 | 16.70 | 0.00 | 0.10 |

## 64-TOKEN RESULT

64 tokens, 13×64 shared points, 64×13×13 cross-layer cosine and distance,
complete 64×64 similarity per layer. No truncation, renderer freeze, missing node
or page error observed. Accessible selector covers overlapping points. Payload
growth +4.86%; loading and interaction costs remain separate above. This is the
fixed public repeated-hello scene, not proof for every prompt or computer.

## GIT

Existing PRIVATE `oliverchenOVO/project-neuron`, main. All Phase 0/0.5 commits
retained, no reinitialization/squash. `07a8fc4`: shared analysis; `40f84dc`:
four-mode microscope. Final validation commit adds evidence/report/README and
corrects first-rAF interval measurement. Private visibility checked by gh CLI.
Final clean/synchronized state is checked after push.

## REMOTE CI

Functional commit `40f84dc` completed both workflows successfully:
[Browser](https://github.com/oliverchenOVO/project-neuron/actions/runs/37188088418),
[Engine](https://github.com/oliverchenOVO/project-neuron/actions/runs/37188088430).
Final validation commit: **CI PENDING**. Push success alone is not CI success.

## ACCEPTANCE GATES

| Gate | Requirement | Status / evidence |
|---|---|---|
| A | Phase 0 retained | PASS — original tests included in 50 |
| B | Phase 0.5 retained | PASS — 29 frontend, 6 E2E, old baselines unchanged |
| C | One real PCA basis | PASS — global fit/mean/components tests |
| D | Genuine shared coordinates | PASS — raw GPT-2 transforms/reproducibility |
| E | Genuine cross-layer similarity | PASS — direct 768D vector checks |
| F | Schema updated | PASS — strict 0.2.0 validation/types |
| G | Real fixtures regenerated | PASS — pinned offline model |
| H | Reproducibility | PASS — independent uncached byte repeats |
| I | Similarity matrix | PASS — genuine cells/signed render |
| J | Ranking | PASS — self excluded/raw descending/negatives |
| K | Space correct | PASS — shared positions/variance/numeric access |
| L | Fixed axes | PASS — E2E layer domain equality |
| M | Actual trail | PASS — 13 genuine coordinates in order |
| N | Non-causal label | PASS — plot/inspector/Info |
| O | Compare | PASS — true FROM/TO metrics and geometry |
| P | Magnitude profile | PASS — 13 real values/accessible readout |
| Q | Change profile | PASS — 12 real changes/EMB N/A |
| R | 64-token Space | PASS — 64 nodes/selector/stress screenshot |
| S | No freeze | PASS — repeated interaction paths/zero errors |
| T | JS p95 target | PASS — all five kinds <50ms |
| U | Production build | PASS — strict TS + Vite |
| V | Python | PASS — 50, zero skip |
| W | Frontend | PASS — 57 |
| X | Playwright | PASS — 11 without updates |
| Y | Visual review | PASS — six scenes + both desktops |
| Z | Private repo | PASS — PRIVATE verified |
| AA | Browser CI | PENDING — final validation commit |
| AB | Engine CI | PENDING — final validation commit |
| AC | No Electron | PASS — no live wiring or packaging |

## KNOWN LIMITATIONS

Precomputed public fixtures only; no editable/private browser inference or Windows
binary. Shared basis/domain fitted per analysis, not aligned across prompts.
Raw PCA is dominated by vector norms/outliers, especially the first token; dense
early-layer clusters are real. Two dimensions lose geometry. PC axes have no
assigned semantic meaning; trail/motion is not causal reasoning; magnitude is
not importance and attention is not a complete explanation. Graph radius is a
display mapping. Lens remains last-position diagnostics. Loading can have
scheduling/network outliers; <50ms target is post-load interaction JS. Screenshots
depend on Windows/Chromium/fonts and do not promise cross-OS equality.

## NEXT REQUIRED MILESTONE

Phase 1B — Layer Journey/showcase polish with honest last-position lens semantics
and presentation sequencing. Electron belongs to 1C; Windows packaging/offline
crash-recovery QA to 1D. Neither starts during this Phase 1A task.
