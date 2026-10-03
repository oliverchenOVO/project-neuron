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
    return [top_predictions(model.lm_head(model.transformer.ln_f(h[-1])), tokenizer, k)
            for h in states]
