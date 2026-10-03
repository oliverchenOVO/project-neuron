# Architecture and data contract

## Phase 0 implemented boundary

`CLI / JSON-line RPC → resident AnalysisEngine → ModelLoader → local PyTorch GPT-2`

`model_loader.py` loads the pinned official tokenizer and safetensors checkpoint,
uses eager attention, sets eval mode, and retains the model. All forward passes
and metrics use `torch.inference_mode()`. The default execution device is CPU.

`inference.py` captures actual block outputs with temporary forward hooks, removed
even when inference fails. It computes presentation metrics in Python. The
renderer contract never includes full hidden vectors, vocabulary logits, or
embedding matrices. Those tensors remain available in Python `ForwardSignals`
for scientific tests. JSON contains their shapes and derived data only.

## Representation indexing

There are 13 representation entries: EMB and L1–L12. EMB is word embedding plus
position embedding after dropout (identity in eval). L1–L12 are the **raw residual
stream outputs** of each transformer block, before final `ln_f`. This keeps layer
changes on a consistent basis. Hugging Face's returned `hidden_states[-1]` is
already final-normalized; it is verified separately, not normalized a second time.

The eventual OUT selection must use final-normalized output and final logits;
OUT is not a thirteenth transformer block. Attention layer 0 corresponds to L1.
EMB has no attention operation. UI must explicitly distinguish these indices.

## Definitions

For token position t and representation h[l,t]:

- Representation Magnitude = sqrt(sum_j h[l,t,j]^2).
- Representation Change = ||h[l,t] − h[l−1,t]||₂. EMB is null (not applicable).
- Hidden-State Similarity = dot(h[l,i], h[l,j]) / (||h[l,i]||₂ ||h[l,j]||₂).
  Zero vectors use zero normalized vectors with denominator epsilon 1e−12.
- Attention = actual softmax attention weights A[layer,head,query,key].
  Future-key entries are zero under GPT-2's causal mask. Head averaging in a
  future UI is an arithmetic mean across heads, with its label shown explicitly.
- 2D PCA Projection = independently center token vectors at each layer; SVD
  X = U S Vᵀ; coordinates = U[:,0:2] S[0:2]. Each axis sign is fixed by making
  its largest absolute loading positive. Explained variance ratio = s_i²/Σs_j².
  A one-token input maps to (0,0). Degenerate variance maps to zero ratios.
  Axes are independent across layers. Motion between coordinates cannot by
  itself be interpreted as a geometric trajectory in a common embedding basis.
- Final Prediction = softmax(final logits at last input position) over **all
  50,257 vocabulary entries**, then top-k selection. Top-k bars need not sum to 1.
- Logit Lens Estimate = softmax(W_U ln_f(h[l,last])) then top-k. This is a
  diagnostic projection, not an actual intermediate prediction process.
  Applying this to raw L12 matches the final model ranking within FP tolerance.

## RPC scaffold

One UTF-8 JSON object per line on stdin/stdout. Logs go to stderr. Every response
echoes the request id and contains either `result` or `error: {code,message}`.

Methods: `ping`, `status`, `analyze` with text and optional top_k, `shutdown`.
Startup is lazy. `status` is `idle` until first analysis, then `ready` or `failed`.
Loading stages are assigned by real loading operations. The Phase 0 worker is
sequential; it cannot answer status while a load/analysis request is blocking.
Live startup events, supervisor timeouts, crash recovery and concurrent status
delivery belong to Phase 1C and are **not implemented yet**.

Maximum input: 64 tokens, no silent truncation. Maximum top_k: 50. Maximum RPC
line: 128 KiB. Eight analysis entries in an in-memory LRU. Cache key includes
model id, revision, local directory, device, full prompt, analysis version and k.
Cached results are copied before delivery to prevent client-side mutations from
corrupting later requests. Raw tensors are not retained in the result cache.

## Planned desktop boundary (not implemented)

`Electron renderer → context-isolated preload IPC → Electron main supervisor →
frozen Python worker (stdin/stdout) → bundled local GPT-2`

The renderer must have no shell access. Production must pass an explicit bundled
model path with local-only loading. A missing folder is a visible failure, never
a synthetic visualization. Only Phase 1D will add PyInstaller and electron-builder.

## Interpretation and privacy

Attention weights show how the attention mechanism distributes weight between
token positions, but they should not automatically be interpreted as a complete
explanation of why a model produced an output. Hidden-state similarity and PCA
are analytical views of internal vector representations. They are not evidence
of consciousness, importance, reasoning probability, or semantic certainty.

Inference and cache are local. Model download contacts Hugging Face; inference
does not transmit prompts. CLI JSON includes tokens and prompt-derived signals,
so generated artifacts are ignored by Git. No analytics or telemetry is added.

## Primary references

- [GPT-2 model card](https://huggingface.co/openai-community/gpt2)
- [Transformers GPT-2 tensor outputs](https://huggingface.co/docs/transformers/v4.57.0/en/model_doc/gpt2)
- [GPT-2 implementation](https://github.com/huggingface/transformers/blob/v4.57.6/src/transformers/models/gpt2/modeling_gpt2.py)
