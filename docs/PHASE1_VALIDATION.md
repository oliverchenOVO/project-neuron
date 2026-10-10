# PHASE 1 STATUS — PHASE 1 INCOMPLETE

Status updated 2026-10-11 (Asia/Taipei). Phase 0 and browser milestones 0.5/1A passed. Phase 1B adds Journey and showcase; see its separate evidence report. The complete
desktop application is not yet implemented, packaged or accepted.

## IMPLEMENTED

Phase 0.5 adds a validated React browser microscope, public real-data fixtures,
attention Canvas/SVG views, token/layer/head controls, inspector, final prediction,
frontend tests, Playwright screenshots and production performance evidence.
Phase 1A adds genuine signed similarity, shared-basis SPACE/TRAIL, cross-layer
COMPARE and profiles. It does not complete the desktop application. See
[Phase 1A evidence](PHASE1A_VALIDATION.md) and PHASE0_5_VALIDATION.md.
Phase 1B adds Layer Journey, last-position Logit Lens / fixed-candidate evolution,
Cinematic presentation, guided showcase and deterministic recording. See
[Phase 1B evidence](PHASE1B_VALIDATION.md). The live desktop boundary remains absent.

Python engine modules, real GPT-2 spike, CLI analysis JSON, derived metrics,
last-position Logit Lens, bounded input/cache, JSON-line RPC scaffold, pinned
local checkpoint acquisition, unit/worker tests and Windows CI workflow.

## MODEL / REAL DATA VALIDATION

Official GPT-2 small, fixed revision, official checkpoint hash verified.
Tokenizer, embeddings, every hidden/attention layer, final logits and full
softmax validated. See [Phase 0 evidence](PHASE0_VALIDATION.md).

## TESTS / PERFORMANCE

55 local Python tests, 82 frontend tests and 23 browser E2E scenes cover the current implementation, with
real-model tests required and old visual baselines preserved. Production build
and Engine/Browser CI are separately verified in PHASE1A_VALIDATION.md. Engine
forward/derived/serialization and browser fetch/parse/validation/render/interaction
costs have separate evidence files. Electron and packaged-build tests remain absent.

## WINDOWS BUILD / OFFLINE VALIDATION

No `neuron-engine.exe`, NSIS installer or portable executable yet. Local-only
Python inference passed with bundled-source files and blocked Python network
connections. Fully packaged desktop offline operation is not verified.

## GITHUB

[oliverchenOVO/project-neuron](https://github.com/oliverchenOVO/project-neuron)
was originally PRIVATE. On 2026-10-04 the owner requested publishing this same
repository; it is now PUBLIC, with the original repository identity, commit
history and Actions records retained. Stable milestones are committed to Git.
Model weights, environment and prompt-derived artifacts are excluded.

## Acceptance gates

PASS is used only for completed gate evidence. PARTIAL means supporting backend
work exists but the complete Phase 1 requirement remains unverified.

| Gate | Requirement | Status / evidence |
|---|---|---|
| A | Real GPT-2 tokenizer | PASS — deterministic BPE + real IDs |
| B | Real hidden states | PASS — 13 actual tensor entries |
| C | Real attentions | PASS — 12 layers × 12 heads |
| D | Real logits | PASS — final `[1,6,50257]`, finite outputs |
| E | Attention heatmap | PARTIAL — browser real fixture view passes; live desktop absent |
| F | Attention arc view | PARTIAL — browser selected-query view passes; live desktop absent |
| G | Layer/head explorer | PARTIAL — browser controls pass; live desktop absent |
| H | Hidden-state similarity view | PARTIAL — signed browser matrix/ranking/graph pass; live desktop absent |
| I | PCA representation view | PARTIAL — shared-basis browser SPACE/TRAIL/COMPARE pass; live desktop absent |
| J | Final top-k prediction view | PARTIAL — browser genuine probability view passes; live desktop absent |
| K | Logit Lens view | PARTIAL — genuine browser diagnostic view implemented; live desktop absent |
| L | Layer Journey | PARTIAL — browser playback and all stage semantics implemented; live desktop absent |
| M | Cinematic Mode | PARTIAL — browser presentation, provenance and recording implemented; live desktop absent |
| N | CPU mode | PARTIAL — Python CPU validated; desktop absent |
| O | Offline mode | PARTIAL — local engine validated; packaged app absent |
| P | Worker crash recovery | NOT IMPLEMENTED |
| Q | Unit tests | PARTIAL — Python and frontend tests pass; desktop tests absent |
| R | Integration tests | PARTIAL — real worker RPC passes; Electron absent |
| S | Visual regression | PARTIAL — browser fixed screenshots pass; desktop absent |
| T | Windows installer | NOT IMPLEMENTED |
| U | Windows portable executable | NOT IMPLEMENTED |
| V | Existing GitHub repository and history | PASS — published in place at owner request; original history retained |

## KNOWN LIMITATIONS

Live startup reporting, Electron supervisor and Windows distribution are not
built. Maximum-length browser JSON has been profiled; worker transport remains
unmeasured.
Current lens data is for the final input position. The original independently fitted PCA field is retained; browser SPACE uses a
separate shared basis with fixed axes and non-causal trajectory labeling. Browser screenshots
are recorded in docs/screenshots; they show precomputed real fixtures.

## NEXT REQUIRED MILESTONE

**Phase 1C — Electron + live local Python worker integration**, then
1D packaging/QA. Phase 2 features stay out of scope until
every Phase 1 acceptance gate passes.
