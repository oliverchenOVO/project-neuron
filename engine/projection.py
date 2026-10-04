import torch
from dataclasses import dataclass


@dataclass
class SharedPCAFit:
    """One centered basis in Python; high-dimensional basis never sent to UI."""
    mean: torch.Tensor
    components: torch.Tensor
    coordinates: torch.Tensor
    explained_variance_ratio: torch.Tensor

    def transform(self, representations):
        x = torch.stack(tuple(representations)).detach().cpu().double()
        return (x - self.mean) @ self.components.T

    def export(self):
        flat = self.coordinates.reshape(-1, 2)
        low, high = flat.amin(0), flat.amax(0)
        span = high - low
        # Constant axes still have a finite, fixed domain; no division by zero.
        padding = torch.where(span > 0, span * .08, torch.ones_like(span) * .5)
        return {"projection_type": "global_pca", "fit_scope": "all_layers_all_tokens",
                "components": 2, "centering": "global_feature_mean",
                "fit_sample_count": len(flat), "domain_padding_fraction": .08,
                "explained_variance_ratio": self.explained_variance_ratio.tolist(),
                "axis_domain": torch.stack((low-padding, high+padding), dim=1).tolist(),
                "coordinates": self.coordinates.tolist()}


def fit_shared_pca(representations):
    """Deterministic float64 symmetric PCA of all samples, no whitening.

    Fit once on globally centered [layers*tokens, hidden]. Transform every
    layer with the identical mean and sign-canonicalized component matrix.
    """
    x = torch.stack(tuple(representations)).detach().cpu().double()
    if x.ndim != 3 or min(x.shape) < 1 or not torch.isfinite(x).all():
        raise ValueError("Shared PCA requires finite [layers,tokens,hidden] input")
    flat = x.reshape(-1, x.shape[-1])
    mean = flat.mean(0)
    centered = flat - mean
    components = torch.zeros(2, x.shape[-1], dtype=torch.float64)
    ratios = torch.zeros(2, dtype=torch.float64)
    total = centered.square().sum()
    if total > 0:
        # Solve the smaller symmetric system; the dual Gram formulation gives
        # the same feature-space PCA directions without materializing left SVD
        # vectors. Float64 reduces covariance conditioning/roundoff costs.
        dual = len(flat) < flat.shape[1]
        gram = centered @ centered.T if dual else centered.T @ centered
        values, vectors = torch.linalg.eigh(gram)
        tolerance = values[-1].clamp_min(0) * max(centered.shape) * torch.finfo(torch.float64).eps
        for axis in range(min(2, len(values))):
            value = values[-axis-1]
            if value <= tolerance:
                continue
            direction = centered.T @ vectors[:, -axis-1] / value.sqrt() if dual else vectors[:, -axis-1].clone()
            direction = direction / direction.norm().clamp_min(1e-20)
            if direction[direction.abs().argmax()] < 0:
                direction.neg_()
            components[axis] = direction
            ratios[axis] = (value / total).clamp(0, 1)
    coordinates = ((flat-mean) @ components.T).reshape(x.shape[0], x.shape[1], 2)
    return SharedPCAFit(mean, components, coordinates, ratios)


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
