import time
import uuid
from types import SimpleNamespace

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient

from app.core import security
from app.main import app


def credentials(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


@pytest.fixture
def signer(monkeypatch):
    key = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(security.jwks_client, "get_signing_key_from_jwt", lambda _: SimpleNamespace(key=key.public_key(), algorithm_name="ES256"))
    def sign(**changes):
        claims = {"sub": str(uuid.uuid4()), "email": "donor@example.com", "exp": int(time.time()) + 300,
                  "aud": "authenticated", "iss": security.ISSUER}
        claims.update(changes)
        return credentials(jwt.encode(claims, key, algorithm="ES256", headers={"kid": "test-key"}))
    return sign


def test_valid_asymmetric_token(signer):
    assert security.verify_token(signer()).email == "donor@example.com"
    assert security.JWKS_URL.endswith("/auth/v1/.well-known/jwks.json")


@pytest.mark.parametrize("claims", [{"exp": 1}, {"aud": "other"}, {"iss": "https://attacker.example"}, {"sub": "bad-id"}, {"email": []}])
def test_reject_invalid_claims(signer, claims):
    with pytest.raises(HTTPException) as error:
        security.verify_token(signer(**claims))
    assert error.value.status_code == 401


def test_invalid_signature(signer):
    token = signer().credentials
    payload = jwt.decode(token, options={"verify_signature": False})
    other = ec.generate_private_key(ec.SECP256R1())
    with pytest.raises(HTTPException) as error:
        security.verify_token(credentials(jwt.encode(payload, other, algorithm="ES256")))
    assert error.value.status_code == 401


@pytest.mark.parametrize("token", ["invalid", jwt.encode({"sub": "fake"}, "", algorithm="none")])
def test_malformed_or_unsigned_token(token):
    with pytest.raises(HTTPException) as error:
        security.verify_token(credentials(token))
    assert error.value.status_code == 401


def test_legacy_auth_uses_verified_user(monkeypatch):
    user_id = uuid.uuid4()
    def get(url, **kwargs):
        assert url == f"{security.ISSUER}/user"
        assert kwargs["headers"]["apikey"] == "test-public-key"
        return httpx.Response(200, json={"id": str(user_id), "email": "verified@example.com"}, request=httpx.Request("GET", url))
    monkeypatch.setattr(security.httpx, "get", get)
    token = jwt.encode({"sub": "untrusted"}, "test-secret-with-at-least-32-bytes", algorithm="HS256")
    assert security.verify_token(credentials(token)).sub == user_id


@pytest.mark.parametrize("response_status, expected", [(401, 401), (403, 401), (500, 503), (429, 503)])
def test_legacy_failures(monkeypatch, response_status, expected):
    monkeypatch.setattr(security.httpx, "get", lambda url, **_: httpx.Response(response_status, request=httpx.Request("GET", url)))
    token = jwt.encode({}, "test-secret-with-at-least-32-bytes", algorithm="HS256")
    with pytest.raises(HTTPException) as error:
        security.verify_token(credentials(token))
    assert error.value.status_code == expected


def test_missing_bearer_is_401():
    response = TestClient(app).get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("origin, expected", [("http://localhost:5173", 200), ("https://frontend.example", 200), ("https://untrusted.example", 400)])
def test_cors_uses_configuration(origin, expected):
    response = TestClient(app).options("/api/v1/auth/me", headers={"Origin": origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"})
    assert response.status_code == expected
    if expected == 200:
        assert response.headers["access-control-allow-origin"] == origin
