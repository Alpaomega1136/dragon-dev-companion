"""Spotify OAuth helpers (PKCE-friendly, no client secret)."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"


def _post_form(payload: dict[str, str]) -> dict[str, Any]:
    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        SPOTIFY_TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read().decode("utf-8")
            parsed = json.loads(body)
            message = parsed.get("error_description") or parsed.get("error") or "Spotify error."
        except (OSError, json.JSONDecodeError, AttributeError):
            message = "Spotify token request failed."
        return {"error": message}
    except urllib.error.URLError:
        return {"error": "Spotify connection failed."}


def exchange_code(
    client_id: str,
    code: str,
    code_verifier: str,
    redirect_uri: str,
) -> dict[str, Any]:
    payload = {
        "client_id": client_id,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
    }
    return _post_form(payload)


def refresh_token(client_id: str, refresh_token: str) -> dict[str, Any]:
    payload = {
        "client_id": client_id,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    return _post_form(payload)
