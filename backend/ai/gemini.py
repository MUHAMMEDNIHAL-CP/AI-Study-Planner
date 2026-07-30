import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


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
    return [
        (model, f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}")
        for model in models
    ]


def generate_text(prompt, *, json_mode=False, timeout=25, return_error=False):
    endpoints = _endpoints()
    if not endpoints:
        return (None, "GEMINI_API_KEY is not configured") if return_error else None

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
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
            headers={"Content-Type": "application/json"},
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
        except (URLError, TimeoutError) as error:
            last_error = f"{model}: {error}"
        except (KeyError, IndexError, TypeError, json.JSONDecodeError):
            last_error = f"{model}: Gemini returned an unexpected response"

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


