# Browser microscope design contract

One scientific instrument surface; React/TypeScript/Vite/Zustand, Canvas matrix,
SVG relationships, no inference HTTP endpoint. The static development/preview
server only serves frontend files. No Electron, accounts or hosted inference.

## Source of visual authority

The user's supplied screen, copy, terminology and technical restrictions are
the design specification. The no-cloud / no-synthetic-visualization requirements
take precedence over frontend-app-builder's usual ImageGen concept workflow.
There are no generated raster charts, illustrative signal patterns or image-as-UI
assets. Actual model data is the only visual source. Fidelity is checked against
this contract and fixed real-data screenshots, not an invented bitmap chart.

## Layout and system

At 1920×1080: a quiet 64px header, public-fixture prompt band, horizontal token
strip, central microscope with 76px layer rail and ~290px inspector, then final
probability strip. The microscope occupies the largest area. At 1440×900 and
1280×720 chrome contracts; inspector scrolls internally where necessary. Desktop
is the supported surface; no unrelated mobile composition is introduced.

Palette: graphite #0b1118, panel #101923, border #22303e, foreground #e4edf4,
muted #8496a9, cyan #74ddd9, violet #a39adb, amber #d8af72. No large gradients,
particles, fake brain, pulses, 3D or WebGL. Borders are 1px; radius 3–6px.
Segoe UI/system sans for content; Consolas/system monospace for numerical data.
Body 13px, controls 12px, labels 10–11px, prompt 24px, brand 20px.

Allowed regions/copy: PROJECT NEURON, AI NEURAL NETWORK MICROSCOPE; MODEL,
PARAMETERS, LAYERS, HEADS, CONTEXT, DATA / REAL FORWARD PASS; SHOWCASE FIXTURE;
PROMPT; Token, Position, TOKEN STRIP; LAYER / EMB / 01–12; ATTENTION MICROSCOPE;
HEATMAP / ARCS; AVG / H01–H12; QUERY / KEY / ATTENTION WEIGHT; TOKEN INSPECTOR;
Representation Magnitude / Representation Change / Strongest Attention Targets;
FINAL NEXT TOKEN / Final Prediction / full-vocabulary softmax; Info.
Functional error/status, accessibility labels, model provenance, keyboard help
and benchmark/stress fixture selection are authorized by the user requirements.
No marketing navigation, fake live status, play control, PCA or lens journey.

## Interactions and math

Attention layers 1–12 map to `attention_matrices[layer−1]`. Magnitude and delta
map to residual stream index `layer`. EMB is disabled because it has no attention.
AVG is the arithmetic mean across all twelve heads, with no renormalization.
All N×N cells remain present, including the future triangle of zeros.
Canvas color is a fixed deterministic function of actual weight, never a random
or per-screen percentile map. At 64 tokens only axis label density decreases;
all 4,096 values are still drawn and selectable with keyboard or pointer.

Token selection is global and opens ARCS, satisfying the specified sat → arcs
workflow. HEATMAP can be revisited with the same selection. Arcs show at most
five positive legal keys (key≤query), sorted by real weight then position.
Width = 0.8 + 7w px; opacity = 0.2 + 0.8w. Self-attention is a loop, not a
fictional cross-token relationship. No selected token means no edges.
Prediction bar fraction is the genuine probability, not divided by the largest
visible candidate. Top-k probabilities are not renormalized.

Data is parsed and semantically validated once per fixture load. Switching layer,
head, token or mode preserves analysis object identity. Head means are memoized
per analysis/layer. Prediction chrome is memoized independently. Selection
transitions are at most 160ms; reduced motion disables them.

## QA contract

Production build, original Python tests, runtime contract/interaction tests,
Playwright fixed 1920×1080 matrix/arc/layer-head/stress snapshots, plus 1440×900
and 1280×720 control visibility. Browser plugin skill is unavailable in this
session; regular Playwright is explicitly required by the user and used for
repeatable snapshots/performance. In-app browser can show the finished prototype.
Screenshot review checks composition, accurate copy, palette, type scale,
canvas/inspector balance, spacing, full control visibility and responsive fit.
