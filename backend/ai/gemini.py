import json
import logging
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

logger = logging.getLogger("flox.ai.gemini")

# Hard cap on prompt length to prevent abuse / excessive API cost.
MAX_PROMPT_CHARS = 8000
MIN_PROMPT_CHARS = 1

# Characters that could be used for prompt-injection style escapes; we replace
# control characters and overly long whitespace runs before sending upstream.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WHITESPACE_RE = re.compile(r"\s{4,}")


def sanitize_prompt(prompt, *, max_chars=MAX_PROMPT_CHARS, default=""):
    """Validate and sanitize a user-supplied prompt before sending to Gemini.

    Returns a cleaned string. Raises ValueError if the prompt is empty after
    cleaning or exceeds the hard cap.
    """
    if not isinstance(prompt, str):
        raise ValueError("Prompt must be a string.")
    cleaned = _CONTROL_RE.sub(" ", prompt)
    cleaned = _WHITESPACE_RE.sub(" ", cleaned).strip()
    if len(cleaned) > max_chars:
        raise ValueError(f"Prompt exceeds maximum length of {max_chars} characters.")
    return cleaned or default


def gemini_configured():
    return bool(os.getenv("GEMINI_API_KEY"))


def _endpoints():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return []
    configured = os.getenv("GEMINI_MODELS") or os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    models = [model.strip() for model in configured.split(",") if model.strip()]
    if "gemini-3.1-flash-lite" not in models:
        models.append("gemini-3.1-flash-lite")
    # Keep the API key in a header (x-goog-api-key) rather than the URL query
    # string so it never shows up in proxy/access logs.
    return [
        (model, f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent")
        for model in models
    ]


def generate_text(prompt, *, json_mode=False, timeout=25, return_error=False):
    try:
        clean_prompt = sanitize_prompt(prompt)
    except ValueError as exc:
        if return_error:
            return None, str(exc)
        return None

    endpoints = _endpoints()
    if not endpoints:
        return (None, "GEMINI_API_KEY is not configured") if return_error else None

    api_key = os.getenv("GEMINI_API_KEY")
    body = {
        "contents": [{"parts": [{"text": clean_prompt}]}],
        "generationConfig": {
            "temperature": 0.55,
            "topP": 0.9,
        },
    }
    if json_mode:
        body["generationConfig"]["response_mime_type"] = "application/json"

    last_error = None
    for model, url in endpoints:
        request = Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=timeout) as response:
                raw = json.loads(response.read().decode("utf-8"))
            text = raw["candidates"][0]["content"]["parts"][0]["text"]
            return (text, None) if return_error else text
        except HTTPError as error:
            try:
                details = json.loads(error.read().decode("utf-8"))
                message = details.get("error", {}).get("message", f"HTTP {error.code}")
            except (json.JSONDecodeError, UnicodeDecodeError):
                message = f"HTTP {error.code}"
            last_error = f"{model}: {message}"
            logger.warning("Gemini HTTP error for %s: %s", model, message)
        except (URLError, TimeoutError) as error:
            last_error = f"{model}: {error}"
            logger.warning("Gemini network error for %s: %s", model, error)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            last_error = f"{model}: Gemini returned an unexpected response"
            logger.exception("Unexpected Gemini response for %s", model)

    return (None, last_error or "Gemini request failed") if return_error else None


def generate_json(prompt, *, timeout=25, return_error=False):
    text_result = generate_text(prompt, json_mode=True, timeout=timeout, return_error=return_error)
    if return_error:
        text, error = text_result
        if error:
            return None, error
    else:
        text = text_result
    if not text:
        return (None, "Gemini returned an empty response") if return_error else None

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        parsed = json.loads(cleaned)
        return (parsed, None) if return_error else parsed
    except json.JSONDecodeError:
        match = re.search(r"(\{.*\}|\[.*\])", cleaned, flags=re.DOTALL)
        if not match:
            return (None, "Gemini response was not valid JSON") if return_error else None
        try:
            parsed = json.loads(match.group(1))
            return (parsed, None) if return_error else parsed
        except json.JSONDecodeError:
            return (None, "Gemini response was not valid JSON") if return_error else None

