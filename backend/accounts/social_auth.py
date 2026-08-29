import logging

import jwt

logger = logging.getLogger("flox")

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"

GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}
APPLE_ISSUER = "https://appleid.apple.com"

GOOGLE_ALGORITHMS = ["RS256"]
APPLE_ALGORITHMS = ["ES256"]


class InvalidTokenError(Exception):
    pass


class UnverifiedEmailError(InvalidTokenError):
    pass


def _decode_token(token, jwks_url, audience, algorithms, expected_issuer):
    try:
        client = jwt.PyJWKClient(jwks_url, cache_keys=True)
        signing_key = client.get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            signing_key,
            algorithms=algorithms,
            audience=audience,
            issuer=expected_issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
    except InvalidTokenError:
        raise
    except Exception as exc:
        logger.warning("Social token rejection (%s): %s", expected_issuer, exc)
        raise InvalidTokenError("The sign-in token is invalid or expired.") from exc


def verify_google_id_token(id_token, client_id):
    if not client_id:
        raise InvalidTokenError("Google sign-in is not configured on the server (GOOGLE_OAUTH_CLIENT_ID).")
    claims = _decode_token(id_token, GOOGLE_JWKS_URL, client_id, GOOGLE_ALGORITHMS, None)
    iss = (claims.get("iss") or "").rstrip("/")
    if iss not in GOOGLE_ISSUERS:
        raise InvalidTokenError("Invalid Google token issuer.")
    if claims.get("email") and not claims.get("email_verified"):
        raise UnverifiedEmailError("Your Google email is not verified.")
    return claims


def verify_apple_id_token(id_token, client_id, expected_nonce=None):
    if not client_id:
        raise InvalidTokenError("Apple sign-in is not configured on the server (APPLE_CLIENT_ID).")
    claims = _decode_token(id_token, APPLE_JWKS_URL, client_id, APPLE_ALGORITHMS, APPLE_ISSUER)
    if expected_nonce and claims.get("nonce") != expected_nonce:
        raise InvalidTokenError("Apple sign-in nonce mismatch.")
    return claims