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

# Sentinel returned when the upstream Gemini project quota is exhausted so the
# caller can surface a friendly "FLOX is temporarily unavailable" instead of a
# raw resource-exhausted error.
QUOTA_EXHAUSTED = "QUOTA_EXHAUSTED"

# Upstream status codes that indicate the project quota/rate limit was hit.
_QUOTA_HTTP_CODES = (429, 500, 503)


def _is_quota_message(message):
    lowered = (message or "").lower()
    return any(
        marker in lowered
        for marker in (
            "resource exhausted",
            "quota",
            "rate limit",
            "429",
            "503",
            "temporarily overloaded",
        )
    )


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
    # Prioritize the lightweight flash-lite model first for lower latency, then
    # fall back to the other configured models if it fails or is unavailable.
    fast_models = [model for model in models if "flash-lite" in model]
    other_models = [model for model in models if "flash-lite" not in model]
    models = fast_models + other_models
    if "gemini-3.1-flash-lite" not in models:
        models.append("gemini-3.1-flash-lite")
    # Keep the API key in a header (x-goog-api-key) rather than the URL query
    # string so it never shows up in proxy/access logs.
    return [
        (model, f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent")
        for model in models
    ]


def generate_text(prompt, *, json_mode=False, timeout=25, return_error=False, return_usage=False):
    """Return (text, error[, tokens]) or (text[, tokens]) depending on flags.

    On upstream quota/resource-exhausted errors the returned error is the
    QUOTA_EXHAUSTED sentinel so callers can map it to a friendly message.
    """
    try:
        clean_prompt = sanitize_prompt(prompt)
    except ValueError as exc:
        if return_error or return_usage:
            return (None, str(exc), 0) if return_usage else (None, str(exc))
        return None

    endpoints = _endpoints()
    if not endpoints:
        error = "GEMINI_API_KEY is not configured"
        if return_usage:
            return (None, error, 0) if return_error else (None, None, 0)
        return (None, error) if return_error else None

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
            tokens = 0
            try:
                tokens = int(raw.get("usageMetadata", {}).get("totalTokenCount") or 0)
            except (TypeError, ValueError):
                tokens = 0
            if return_usage:
                return (text, None, tokens) if return_error else (text, tokens)
            return (text, None) if return_error else text
        except HTTPError as error:
            try:
                details = json.loads(error.read().decode("utf-8"))
                message = details.get("error", {}).get("message", f"HTTP {error.code}")
            except (json.JSONDecodeError, UnicodeDecodeError):
                message = f"HTTP {error.code}"
            if error.code in _QUOTA_HTTP_CODES or _is_quota_message(message):
                last_error = QUOTA_EXHAUSTED
            else:
                last_error = f"{model}: {message}"
            logger.warning("Gemini HTTP error for %s: %s", model, message)
        except (URLError, TimeoutError) as error:
            last_error = f"{model}: {error}"
            logger.warning("Gemini network error for %s: %s", model, error)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            last_error = f"{model}: Gemini returned an unexpected response"
            logger.exception("Unexpected Gemini response for %s", model)

    if return_usage:
        return (None, last_error or "Gemini request failed", 0) if return_error else (None, last_error, 0)
    return (None, last_error or "Gemini request failed") if return_error else None


def generate_json(prompt, *, timeout=25, return_error=False, return_usage=False):
    """Return (parsed_dict, error[, tokens]) or (parsed_dict[, tokens]).

    When return_usage is set the return is a 3-tuple (result, error, tokens);
    error is None on success. result is None (and error set) on failure.
    """
    text, error, tokens = generate_text(
        prompt,
        json_mode=True,
        timeout=timeout,
        return_error=return_error or return_usage,
        return_usage=True,
    )
    if error:
        if return_usage:
            return None, error, tokens
        return None, error
    if not text:
        if return_usage:
            return None, "Gemini returned an empty response", tokens
        return (None, "Gemini returned an empty response") if return_error else None

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"(\{.*\}|\[.*\])", cleaned, flags=re.DOTALL)
        if not match:
            if return_usage:
                return None, "Gemini response was not valid JSON", tokens
            return (None, "Gemini response was not valid JSON") if return_error else None
        try:
            parsed = json.loads(match.group(1))
        except json.JSONDecodeError:
            if return_usage:
                return None, "Gemini response was not valid JSON", tokens
            return (None, "Gemini response was not valid JSON") if return_error else None
    if return_usage:
        return parsed, None, tokens
    return (parsed, None) if return_error else parsed