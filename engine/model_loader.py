from pathlib import Path
import torch
from transformers import GPT2LMHeadModel, GPT2TokenizerFast
from .errors import EngineError

MODEL_ID = "openai-community/gpt2"
# Immutable upstream snapshot, shared by tokenizer and model.
MODEL_REVISION = "607a30d783dfa663caf39e06633721c8d4cfcd7e"


class ModelLoader:
    def __init__(self, model_dir=None, offline=False, device="cpu"):
        if device not in ("cpu", "cuda"):
            raise EngineError("INVALID_PARAMS", "Device must be cpu or cuda.")
        if device == "cuda" and not torch.cuda.is_available():
            raise EngineError("DEVICE_UNAVAILABLE", "CUDA requested but unavailable; select CPU.")
        self.model_dir = Path(model_dir).resolve() if model_dir else None
        self.offline = offline or self.model_dir is not None
        self.device = device
        self.state = "idle"
        self.error = None
        self.tokenizer = None
        self.model = None

    def status(self):
        return {"stage": self.state, "model": MODEL_ID, "device": self.device,
                "local_only": self.offline, "error": self.error}

    def load(self):
        if self.model is not None:
            return self
        try:
            if self.model_dir and not self.model_dir.is_dir():
                raise EngineError("MODEL_NOT_FOUND", f"Local model folder missing: {self.model_dir}")
            source = str(self.model_dir) if self.model_dir else MODEL_ID
            opts = {"local_files_only": self.offline}
            if not self.model_dir:
                opts["revision"] = MODEL_REVISION
            self.state = "loading_tokenizer"
            tokenizer = GPT2TokenizerFast.from_pretrained(source, **opts)
            self.state = "loading_model"
            model = GPT2LMHeadModel.from_pretrained(
                source, attn_implementation="eager", use_safetensors=True, **opts
            ).to(self.device).eval()
            self.state = "initializing_analysis_engine"
            c = model.config
            if (c.model_type, c.n_layer, c.n_head, c.n_embd, c.vocab_size) != (
                "gpt2", 12, 12, 768, 50257
            ):
                raise EngineError("UNSUPPORTED_MODEL_DATA", "Phase 0 requires GPT-2 small (12/12/768/50257).")
            self.tokenizer, self.model = tokenizer, model
            self.error = None
            self.state = "ready"
            return self
        except Exception as exc:
            self.state = "failed"
            error = exc if isinstance(exc, EngineError) else EngineError(
                "MODEL_NOT_FOUND" if isinstance(exc, OSError) else "MODEL_LOAD_FAILED", str(exc)
            )
            self.error = error.as_dict()
            raise error from exc
