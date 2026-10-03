import torch
import torch.nn.functional as F


def cosine_matrix(hidden):
    unit = F.normalize(hidden.float(), p=2, dim=-1, eps=1e-12)
    return (unit @ unit.T).clamp(-1, 1)
