import os
from pathlib import Path
import pytest
import torch
from engine.inference import AnalysisEngine
from engine.model_loader import ModelLoader

PROMPT = "The cat sat on the mat"


@pytest.fixture(scope="session")
def real_engine():
    # No mock weights and no skipped real-model tests. Download before running.
    torch.set_num_threads(min(4, os.cpu_count() or 1))
    directory = os.environ.get("NEURON_MODEL_DIR")
    bundled = Path(__file__).resolve().parents[1] / "resources/models/gpt2"
    if not directory and bundled.is_dir():
        directory = str(bundled)
    return AnalysisEngine(ModelLoader(directory, offline=True))


@pytest.fixture(scope="session")
def signals(real_engine):
    return real_engine.forward(PROMPT)


@pytest.fixture(scope="session")
def analysis(real_engine):
    return real_engine.analyze(PROMPT)
