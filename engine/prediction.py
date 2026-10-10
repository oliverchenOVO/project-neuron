import torch


def top_predictions(logits, tokenizer, k=10):
    # Preserve genuine model logits; use float64 for the 50,257-way
    # normalization to avoid float32 denominator accumulation error.
    probabilities = torch.softmax(logits.double(), dim=-1)
    values, indices = torch.topk(probabilities, k=k)
    return [{"token_id": int(i), "token": tokenizer.decode([int(i)],
             clean_up_tokenization_spaces=False), "probability": float(p),
             "logit": float(logits[i])} for p, i in zip(values, indices)]


def logit_lens(model, states, tokenizer, k=10):
    # Each state is pre-ln_f, including the raw final block output.
    # Normalize exactly once, then project the last input position.
    return [top_predictions(x, tokenizer, k) for x in lens_logits(model, states)]


def lens_logits(model, states):
    """Last-position diagnostic projections; raw residual -> ln_f -> LM head."""
    return [model.lm_head(model.transformer.ln_f(h[-1])) for h in states]


def prediction_evolution(projected_logits, final_logits, final_top_k, position):
    """Five fixed final candidates, normalized over the entire vocabulary.

    Full vocabulary tensors are used only inside the engine, never serialized.
    OUT uses genuine forward logits rather than an inferred extra residual state.
    """
    candidates = final_top_k[:5]
    ids = [p["token_id"] for p in candidates]
    logits, probabilities = [], []
    for values in [*projected_logits, final_logits]:
        normalized = torch.softmax(values.double(), dim=-1)
        logits.append([float(values[i]) for i in ids])
        probabilities.append([float(normalized[i]) for i in ids])
    return {
        "position": position,
        "stages": ["EMB", *[f"L{i:02}" for i in range(1, 13)], "OUT"],
        "probability_basis": "full_vocabulary_softmax_float64",
        "projection": "raw_residual -> final_ln_f -> lm_head; OUT = forward logits",
        "candidates": [{"token_id": c["token_id"], "token": c["token"],
                        "logits": [row[j] for row in logits],
                        "probabilities": [row[j] for row in probabilities]}
                       for j, c in enumerate(candidates)],
    }
