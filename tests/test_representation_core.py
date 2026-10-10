import torch
import pytest
from engine.projection import fit_shared_pca
from engine.similarity import same_token_layer_metrics


def test_shared_real_shape_and_single_basis(signals):
    fit = fit_shared_pca(signals.representations)
    assert fit.coordinates.shape == (13, 6, 2)
    assert fit.components.shape == (2, 768)
    stacked = torch.stack(signals.representations).double()
    torch.testing.assert_close(fit.mean, stacked.reshape(-1, 768).mean(0))
    for layer in range(13):
        torch.testing.assert_close(fit.coordinates[layer], (stacked[layer]-fit.mean) @ fit.components.T)
    torch.testing.assert_close(fit.transform(signals.representations), fit.coordinates)
    torch.testing.assert_close(fit.coordinates.mean((0, 1)), torch.zeros(2, dtype=torch.float64), atol=1e-10, rtol=0)
    assert torch.isfinite(fit.coordinates).all()
    assert torch.isfinite(fit.explained_variance_ratio).all()
    assert 0 <= fit.explained_variance_ratio.sum() <= 1 + 1e-12
    domains = torch.tensor(fit.export()["axis_domain"])
    assert ((fit.coordinates >= domains[:, 0]) & (fit.coordinates <= domains[:, 1])).all()


def test_shared_determinism(signals):
    a, b = fit_shared_pca(signals.representations), fit_shared_pca(signals.representations)
    assert torch.equal(a.components, b.components)
    assert a.export() == b.export()


@pytest.mark.parametrize('states', [[torch.zeros(1, 4)]*13, [torch.ones(3, 4)]*13,
                                     [torch.tensor([[1., 2., 3.]])]])
def test_shared_degenerate(states):
    fit = fit_shared_pca(states)
    assert torch.equal(fit.coordinates, torch.zeros_like(fit.coordinates))
    assert torch.equal(fit.explained_variance_ratio, torch.zeros(2, dtype=torch.float64))
    assert all(a < b for a, b in fit.export()["axis_domain"])


def test_shared_rank_one_and_variance():
    states = [torch.tensor([[0., 0.], [1., 2.]]), torch.tensor([[2., 4.], [3., 6.]])]
    fit = fit_shared_pca(states)
    assert fit.explained_variance_ratio.tolist() == pytest.approx([1, 0])
    assert torch.equal(fit.coordinates[..., 1], torch.zeros_like(fit.coordinates[..., 1]))
    assert fit.components[0, fit.components[0].abs().argmax()] > 0


def test_shared_invalid():
    with pytest.raises(ValueError):
        fit_shared_pca([torch.tensor([[float('nan')]])])


@pytest.mark.parametrize('shape', [(2, 2, 8), (2, 5, 4)])
def test_symmetric_solver_agrees_with_full_svd(shape):
    states = torch.arange(torch.tensor(shape).prod(), dtype=torch.float64).sin().reshape(shape)
    fit = fit_shared_pca(tuple(states))
    centered = states.reshape(-1, shape[-1]) - states.reshape(-1, shape[-1]).mean(0)
    _, values, vh = torch.linalg.svd(centered, full_matrices=False)
    for axis in range(2):
        direction = vh[axis].clone()
        if direction[direction.abs().argmax()] < 0:
            direction.neg_()
        torch.testing.assert_close(fit.components[axis], direction, atol=1e-10, rtol=1e-10)
    torch.testing.assert_close(fit.explained_variance_ratio, values[:2].square()/values.square().sum(), atol=1e-12, rtol=1e-12)


def test_cross_layer_real_values(signals, analysis):
    cosine, distance = same_token_layer_metrics(signals.representations)
    c, d = torch.tensor(cosine), torch.tensor(distance)
    assert c.shape == d.shape == (6, 13, 13)
    torch.testing.assert_close(c, c.transpose(1, 2))
    torch.testing.assert_close(d, d.transpose(1, 2))
    torch.testing.assert_close(c.diagonal(dim1=1, dim2=2), torch.ones(6, 13))
    assert torch.equal(d.diagonal(dim1=1, dim2=2), torch.zeros(6, 13))
    for layer in range(1, 13):
        torch.testing.assert_close(d[:, layer-1, layer], torch.tensor(analysis['representation_delta'][layer]), rtol=1e-5, atol=1e-5)
    a, b = signals.representations[3][2].double(), signals.representations[9][2].double()
    assert cosine[2][3][9] == pytest.approx(float(torch.nn.functional.cosine_similarity(a, b, dim=0)), abs=1e-12)
    assert distance[2][3][9] == pytest.approx(float((a-b).norm()), abs=1e-10)


def test_cross_layer_zero_convention():
    cosine, distance = same_token_layer_metrics([torch.zeros(1, 3)]*13)
    assert torch.equal(torch.tensor(cosine), torch.zeros(1, 13, 13))
    assert torch.equal(torch.tensor(distance), torch.zeros(1, 13, 13))


def test_core_schema_export(analysis):
    assert analysis['metadata']['analysis_version'] == '0.3.0'
    assert analysis['shared_pca']['projection_type'] == 'global_pca'
    assert analysis['shared_pca']['fit_scope'] == 'all_layers_all_tokens'
    assert analysis['shared_pca']['fit_sample_count'] == 78
    assert len(analysis['pca_coordinates']) == 13  # Original field unchanged.
    assert torch.tensor(analysis['same_token_layer_similarity']).shape == (6, 13, 13)
    assert torch.tensor(analysis['same_token_layer_distance']).shape == (6, 13, 13)


def test_real_fixture_repeat(real_engine):
    from scripts.generate_showcase_fixture import fixture_result, serialize
    first = serialize(fixture_result(real_engine, 'showcase'))
    real_engine.cache.clear()
    assert serialize(fixture_result(real_engine, 'showcase')) == first
