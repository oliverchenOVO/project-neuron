import torch


def pca_2d(hidden):
    """Centered SVD PCA; deterministic sign, pad rank < 2 with zero axes."""
    x = hidden.float()
    centered = x - x.mean(dim=0, keepdim=True)
    if len(x) == 1:
        return {"coordinates": [[0.0, 0.0]], "explained_variance_ratio": [0.0, 0.0]}
    u, s, vh = torch.linalg.svd(centered, full_matrices=False)
    count = min(2, len(s))
    coordinates = u[:, :count] * s[:count]
    for axis in range(count):
        pivot = vh[axis].abs().argmax()
        sign = torch.where(vh[axis, pivot] < 0, -1.0, 1.0)
        coordinates[:, axis] *= sign
    ratios = s[:count].square() / s.square().sum().clamp_min(1e-20)
    if count < 2:
        coordinates = torch.nn.functional.pad(coordinates, (0, 2 - count))
        ratios = torch.nn.functional.pad(ratios, (0, 2 - count))
    return {"coordinates": coordinates.cpu().tolist(),
            "explained_variance_ratio": ratios.cpu().tolist()}
