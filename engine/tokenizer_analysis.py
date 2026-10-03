from .errors import EngineError
from .config import MAX_TOKENS


def tokenize(tokenizer, text):
    if not isinstance(text, str) or not text.strip():
        raise EngineError("INVALID_INPUT", "Enter non-empty text.")
    if len(text) > 32768:
        raise EngineError("INPUT_TOO_LONG", "Input exceeds the 32768-character safety limit.")
    encoded = tokenizer(text, return_tensors="pt", add_special_tokens=False,
                        return_offsets_mapping=True, truncation=False)
    ids = encoded["input_ids"][0].tolist()
    if len(ids) > MAX_TOKENS:
        raise EngineError("INPUT_TOO_LONG", f"Input has {len(ids)} tokens; maximum is {MAX_TOKENS}.")
    pieces = tokenizer.convert_ids_to_tokens(ids)
    tokens = [{"position": i, "id": tid, "text": tokenizer.decode([tid],
               clean_up_tokenization_spaces=False), "piece": pieces[i],
               "offset": encoded["offset_mapping"][0, i].tolist()}
              for i, tid in enumerate(ids)]
    return encoded["input_ids"], tokens
