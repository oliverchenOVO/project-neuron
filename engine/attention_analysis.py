import torch
from .errors import EngineError


def validate_attention(attentions, layers, heads, length):
    if attentions is None or len(attentions) != layers:
        raise EngineError("UNSUPPORTED_MODEL_DATA", "Model did not return all attention layers.")
    for weights in attentions:
        if weights is None or tuple(weights.shape) != (1, heads, length, length):
            raise EngineError("UNSUPPORTED_MODEL_DATA", "Unexpected attention tensor shape.")
        if not torch.isfinite(weights).all():
            raise EngineError("UNSUPPORTED_MODEL_DATA", "Non-finite attention weights.")


def serialize_attention(attentions):
    # [layer][head][query][key]; float32 preserves the actual model values.
    return [a[0].float().cpu().tolist() for a in attentions]
