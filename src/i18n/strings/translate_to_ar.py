import json
import re
import sys
import time
from typing import Any, Dict, List

from deep_translator import GoogleTranslator

# Preserves: %(name)s, {name}, {0}, HTML-like tags (<a>...</a>, <SpaceName/>), URLs, HTML entities.
TOKEN_PATTERN = re.compile(
    r"%\([^)]+\)[a-zA-Z]"           # Python-style placeholders: %(count)s
    r"|{[^}]+}"                     # Braced placeholders: {name} or {0}
    r"|</?[^>]+?/?>"                # HTML-like tags: <a>, </a>, <SpaceName/>
    r"|https?://\S+"                # URLs
    r"|&[a-zA-Z0-9#]+;"             # HTML entities: &nbsp; etc.
)

RTL_MARK = "\u200F"

# Initialize translator once
translator = GoogleTranslator(source="en", target="ar")

# Cache to avoid re-translating identical segments
_cache: Dict[str, str] = {}

def safe_translate_text(text: str) -> str:
    """
    Translate a plain segment (no tokens) to Arabic.
    Never returns None; falls back to original text on any failure.
    Uses a small cache to reduce API calls.
    """
    if not text or not text.strip():
        return text

    if text in _cache:
        return _cache[text]

    # Try a couple of times in case of transient hiccups
    for attempt in range(2):
        try:
            out = translator.translate(text)
            if not isinstance(out, str) or out is None or out.strip() == "":
                out = text  # fallback to original
            _cache[text] = out
            return out
        except Exception:
            # brief backoff then try again
            time.sleep(0.6)

    # final fallback
    _cache[text] = text
    return text

def split_keep_tokens(text: str) -> List[str]:
    parts = TOKEN_PATTERN.split(text)
    tokens = TOKEN_PATTERN.findall(text)
    result: List[str] = []
    # Recombine alternating parts and tokens while keeping tokens intact
    for i, part in enumerate(parts):
        result.append(part if isinstance(part, str) else str(part))
        if i < len(tokens):
            tok = tokens[i]
            result.append(tok if isinstance(tok, str) else str(tok))
    return result

def protect_and_translate(text: str) -> str:
    if not isinstance(text, str):
        return text

    # Quick exit
    if text.strip() == "":
        return text

    pieces = split_keep_tokens(text)
    out_pieces: List[str] = []

    for seg in pieces:
        # seg is always a string here
        if TOKEN_PATTERN.fullmatch(seg):
            # Protected token: keep as-is
            out_pieces.append(seg)
        else:
            # Plain segment: translate (safe & cached)
            translated = safe_translate_text(seg) if seg.strip() else seg
            # Ensure string even if library returns weird type
            out_pieces.append(translated if isinstance(translated, str) else str(translated))

    combined = "".join(out_pieces)

    # Prepend RTL mark to help layout engines render Arabic correctly
    if not combined.startswith(RTL_MARK):
        combined = RTL_MARK + combined

    return combined

def translate_obj(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: translate_obj(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [translate_obj(v) for v in obj]
    if isinstance(obj, str):
        return protect_and_translate(obj)
    return obj  # numbers/bools/null untouched

def main():
    # Usage: python translate_to_ar.py en_EN.json ar_AR.json
    if len(sys.argv) < 3:
        print("Usage: python translate_to_ar.py <input_json> <output_json>")
        print("Example: python translate_to_ar.py en_EN.json ar_AR.json")
        sys.exit(1)

    src = sys.argv[1]
    dst = sys.argv[2]

    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)

    translated = translate_obj(data)

    with open(dst, "w", encoding="utf-8") as f:
        json.dump(translated, f, ensure_ascii=False, indent=4)

    print(f"✅ Translation complete → {dst}")

if __name__ == "__main__":
    main()
