import torch


def magnitudes(states):
    return [torch.linalg.vector_norm(h.float(), dim=-1).cpu().tolist() for h in states]


def changes(states):
    # Embedding has no preceding representation. Null means not applicable.
    return [[None] * states[0].shape[0]] + [
        torch.linalg.vector_norm(b.float() - a.float(), dim=-1).cpu().tolist()
        for a, b in zip(states, states[1:])
    ]
