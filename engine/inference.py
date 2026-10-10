from collections import OrderedDict
from copy import deepcopy
from dataclasses import dataclass
import time
import torch
import transformers
from . import ANALYSIS_VERSION
from .attention_analysis import serialize_attention, validate_attention
from .errors import EngineError
from .hidden_state_analysis import magnitudes, changes
from .model_loader import ModelLoader, MODEL_ID
from .prediction import lens_logits, prediction_evolution, top_predictions
from .projection import pca_2d, fit_shared_pca
from .similarity import cosine_matrix, same_token_layer_metrics
from .tokenizer_analysis import MAX_TOKENS, tokenize


@dataclass
class ForwardSignals:
    input_ids: torch.Tensor
    tokens: list
    word_embeddings: torch.Tensor
    position_embeddings: torch.Tensor
    representations: tuple
    hf_hidden_states: tuple
    attentions: tuple
    logits: torch.Tensor


class AnalysisEngine:
    def __init__(self, loader=None, cache_size=8):
        self.loader = loader or ModelLoader()
        self.cache_size = cache_size
        self.cache = OrderedDict()

    @torch.inference_mode()
    def forward(self, text):
        self.loader.load()
        model, tokenizer = self.loader.model, self.loader.tokenizer
        input_ids, tokens = tokenize(tokenizer, text)
        input_ids = input_ids.to(self.loader.device)
        positions = torch.arange(input_ids.shape[1], device=input_ids.device).unsqueeze(0)
        word = model.transformer.wte(input_ids)
        positional = model.transformer.wpe(positions)
        # HF's final hidden-state entry is already ln_f normalized. Capture raw
        # block outputs to avoid double normalization in the lens and to keep
        # representation deltas consistently on the residual stream.
        block_outputs = []
        def capture(_module, _inputs, output):
            block_outputs.append(output[0] if isinstance(output, tuple) else output)
        hooks = [block.register_forward_hook(capture) for block in model.transformer.h]
        try:
            outputs = model(input_ids, output_hidden_states=True, output_attentions=True,
                            use_cache=False, return_dict=True)
        finally:
            for hook in hooks:
                hook.remove()
        c = model.config
        validate_attention(outputs.attentions, c.n_layer, c.n_head, len(tokens))
        if len(block_outputs) != c.n_layer or outputs.hidden_states is None:
            raise EngineError("UNSUPPORTED_MODEL_DATA", "Missing hidden states.")
        expected_hidden = (1, len(tokens), c.n_embd)
        if (len(outputs.hidden_states) != c.n_layer + 1
                or any(tuple(h.shape) != expected_hidden for h in outputs.hidden_states)
                or any(tuple(h.shape) != expected_hidden for h in block_outputs)
                or tuple(outputs.logits.shape) != (1, len(tokens), c.vocab_size)):
            raise EngineError("UNSUPPORTED_MODEL_DATA", "Unexpected hidden-state or logit tensor shape.")
        representations = (outputs.hidden_states[0][0],) + tuple(h[0] for h in block_outputs)
        for h in (*representations, outputs.logits):
            if not torch.isfinite(h).all():
                raise EngineError("UNSUPPORTED_MODEL_DATA", "Non-finite model output.")
        return ForwardSignals(input_ids, tokens, word, positional, representations,
                              outputs.hidden_states, outputs.attentions, outputs.logits)

    @torch.inference_mode()
    def analyze(self, text, top_k=10):
        if not isinstance(top_k, int) or isinstance(top_k, bool) or not 1 <= top_k <= 50:
            raise EngineError("INVALID_PARAMS", "top_k must be an integer between 1 and 50.")
        if not isinstance(text, str):
            raise EngineError("INVALID_INPUT", "text must be a string.")
        self.loader.load()
        key = (MODEL_ID, self.loader.revision, str(self.loader.model_dir),
               self.loader.device, text, ANALYSIS_VERSION, top_k)
        started = time.perf_counter()
        if key in self.cache:
            self.cache.move_to_end(key)
            result = deepcopy(self.cache[key])
            result["metadata"]["cache_hit"] = True
            result["metadata"]["request_ms"] = (time.perf_counter() - started) * 1000
            return result
        signals = self.forward(text)
        forward_ms = (time.perf_counter() - started) * 1000
        model, tokenizer = self.loader.model, self.loader.tokenizer
        states = signals.representations
        pca = [pca_2d(h) for h in states]
        metric_started = time.perf_counter()
        shared = fit_shared_pca(states).export()
        layer_cosine, layer_distance = same_token_layer_metrics(states)
        new_metrics_ms = (time.perf_counter() - metric_started) * 1000
        prediction_started = time.perf_counter()
        projected = lens_logits(model, states)
        final_top_k = top_predictions(signals.logits[0, -1], tokenizer, top_k)
        lens_top_k = [top_predictions(x, tokenizer, top_k) for x in projected]
        evolution = prediction_evolution(projected, signals.logits[0, -1], final_top_k, len(signals.tokens) - 1)
        prediction_evolution_ms = (time.perf_counter() - prediction_started) * 1000
        result = {
            "metadata": {"model": MODEL_ID, "model_revision": self.loader.revision,
                "model_source": str(self.loader.model_dir) if self.loader.model_dir else "huggingface_cache",
                "analysis_version": ANALYSIS_VERSION, "device": self.loader.device,
                "parameter_count": sum(p.numel() for p in model.parameters()),
                "attention_implementation": model.config._attn_implementation,
                "max_tokens": MAX_TOKENS, "sequence_length": len(signals.tokens),
                "representation_basis": "embedding + raw post-block residual streams (before ln_f)",
                "layer_labels": ["EMB"] + [f"L{i}" for i in range(1, 13)],
                "attention_axes": ["layer", "head", "query", "key"],
                "pca_basis": "independent centered PCA per layer; axes are not aligned across layers",
                "logit_lens_position": len(signals.tokens) - 1,
                "local_inference": True, "local_only_loading": self.loader.offline,
                "torch_version": torch.__version__, "transformers_version": transformers.__version__,
                "cache_hit": False, "forward_ms": forward_ms, "new_metrics_ms": new_metrics_ms,
                "prediction_evolution_ms": prediction_evolution_ms},
            "tokens": signals.tokens,
            "token_ids": signals.input_ids[0].cpu().tolist(),
            "layer_count": model.config.n_layer,
            "head_count": model.config.n_head,
            "tensor_shapes": {
                "word_embeddings": list(signals.word_embeddings.shape),
                "position_embeddings": list(signals.position_embeddings.shape),
                "hidden_states": [list(h.shape) for h in signals.hf_hidden_states],
                "raw_representations": [list(h.shape) for h in states],
                "attentions": [list(a.shape) for a in signals.attentions],
                "final_logits": list(signals.logits.shape)},
            "representation_magnitude": magnitudes(states),
            "representation_delta": changes(states),
            "hidden_similarity": [cosine_matrix(h).cpu().tolist() for h in states],
            "pca_coordinates": [p["coordinates"] for p in pca],
            "pca_explained_variance_ratio": [p["explained_variance_ratio"] for p in pca],
            "shared_pca": shared,
            "same_token_layer_similarity": layer_cosine,
            "same_token_layer_distance": layer_distance,
            "attention_matrices": serialize_attention(signals.attentions),
            "final_top_k": final_top_k,
            "logit_lens_top_k": lens_top_k,
            "prediction_evolution": evolution,
        }
        result["metadata"]["analysis_ms"] = (time.perf_counter() - started) * 1000
        result["metadata"]["request_ms"] = result["metadata"]["analysis_ms"]
        self.cache[key] = deepcopy(result)
        while len(self.cache) > self.cache_size:
            self.cache.popitem(last=False)
        return result
