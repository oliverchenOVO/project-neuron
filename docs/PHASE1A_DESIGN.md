# Phase 1A contract

Schema 0.2.0 adds `shared_pca`, `same_token_layer_similarity` and
`same_token_layer_distance`. Existing per-layer `pca_coordinates` and variance
retain their independent-fit meaning. No raw hidden vectors leave Python.

Shared PCA fits one CPU float64 symmetric eigendecomposition to globally centered raw residual
samples `[13*tokens,768]`, without standardizing, whitening or random sampling.
Two sign-canonicalized components transform every layer with the same mean.
The smaller sample Gram/feature covariance matrix is solved; both formulations
give the same feature-space PCA directions. Rank-deficient axes are zero.
Variance ratios divide eigenvalues by total centered squared energy.
One axis domain spans all projected layers with 8% padding; it never changes on
layer selection. Constant axes use a finite half-unit domain. Components/mean
remain internal and are directly tested.

Cross-layer cosine and full hidden-space L2 distance use token-major
`[tokens,13,13]` arrays. Layer 0 = EMB; 1–12 are raw post-block streams before
final normalization. This distance is distinct from projected 2D displacement.

The existing scientific graphite frame remains central. Four primary modes
share selected token/layer/hover; heads affect attention only. Similarity uses a
fixed signed violet/graphite/cyan scale. Ranking excludes self and sorts raw
cosine descending. Graph angles follow token order; radial distance is a bounded
monotonic visual mapping, not a hidden-space metric. Negative edges are dashed.

SPACE uses PC1/PC2 axes and actual explained variance, fixed global domains,
precise selectable points, sparse 64-token labels and an accessible token select
plus numeric list. Manual 240ms linear interpolation connects real projected
states, with reduced-motion disabling interpolation. TRAIL consists of all 13
actual layer positions and denotes ordering, not causality. COMPARE defaults to
L03/L09 and presents actual full-space metrics and shared projected positions.
Inspector microcharts use genuine magnitude/delta with fixed token-profile
domains and persistent keyboard-readable values.

Preserve 0.1.1 fixtures in `public/fixtures/legacy-0.1.1`. Preserve all Phase 0.5
PNG baselines and old evidence. `?legacy=1` serves the original attention frame
and fixtures for unchanged regression baselines; the normal route gains the
four-mode core. Do not blanket-update existing baselines to mask shell changes.
Browser plugin not available; use the existing Playwright production workflow.
