import torch
import torch.nn.functional as F


def cosine_matrix(hidden):
    unit = F.normalize(hidden.float(), p=2, dim=-1, eps=1e-12)
    return (unit @ unit.T).clamp(-1, 1)


def same_token_layer_metrics(representations):
    """Token × source-layer × target-layer, from raw 768-D streams in Python."""
    x = torch.stack(tuple(representations)).detach().cpu().double().transpose(0, 1)
    if x.ndim != 3 or not torch.isfinite(x).all():
        raise ValueError("Cross-layer metrics require finite representations")
    unit = F.normalize(x, p=2, dim=-1, eps=1e-12)
    cosine = (unit @ unit.transpose(-1, -2)).clamp(-1, 1)
    distance = torch.cdist(x, x, p=2, compute_mode="donot_use_mm_for_euclid_dist")
    return cosine.tolist(), distance.tolist()
