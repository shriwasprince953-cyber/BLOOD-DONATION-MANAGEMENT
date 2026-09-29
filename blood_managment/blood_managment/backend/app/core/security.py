import logging
from typing import Optional

import jwt
import httpx
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, UUID4, ValidationError

from app.core.config import settings

logger = logging.getLogger(__name__)

# FastAPI dependency to extract the Bearer token from the Authorization header
security = HTTPBearer(auto_error=False)

# Base URLs for Supabase Auth endpoints
supabase_url = settings.SUPABASE_URL.rstrip("/")
JWKS_URL = f"{supabase_url}/auth/v1/.well-known/jwks.json"
ISSUER = f"{supabase_url}/auth/v1"

# PyJWKClient natively fetches and caches JWKS.
# It automatically handles key rotation by querying the endpoint again if an unknown 'kid' is encountered.
jwks_client = PyJWKClient(JWKS_URL, timeout=10)
ALLOWED_JWT_ALGORITHMS = {"RS256", "ES256", "EdDSA"}


class TokenData(BaseModel):
    """
    Schema for the extracted JWT payload.
    Application-specific roles (DONOR/ADMIN) are intentionally omitted here 
    to avoid confusion with Supabase's internal 'role' claim ('authenticated').
    Authorization will be resolved later by querying the 'profiles' table using 'sub'.
    """
    sub: UUID4
    email: Optional[str] = None


def verify_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> TokenData:
    """
    Verifies the asymmetric JWT issued by Supabase Auth.
    Defined as a standard `def` (instead of `async def`) so FastAPI natively 
    runs the potentially blocking JWKS network fetch in a background threadpool, 
    preventing any blocking of the main async event loop.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication is required.", headers={"WWW-Authenticate": "Bearer"})
    token = credentials.credentials

    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
        if algorithm == "HS256":
            # Verify legacy tokens with Auth; never trust unverified JWT claims.
            response = httpx.get(
                f"{ISSUER}/user",
                headers={"apikey": settings.SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
                timeout=10,
            )
            if response.status_code in {401, 403}:
                raise jwt.InvalidTokenError("Supabase rejected the token")
            response.raise_for_status()
            user = response.json()
            return TokenData(sub=user["id"], email=user.get("email"))
        if algorithm not in ALLOWED_JWT_ALGORITHMS:
            raise jwt.InvalidAlgorithmError("Unsupported JWT signing algorithm")
        # Dynamically retrieve the correct public signing key based on the token's 'kid' header
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        if signing_key.algorithm_name != algorithm:
            raise jwt.InvalidAlgorithmError("JWT algorithm does not match signing key")

        # Decode and rigorously validate the token claims
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=[algorithm],
            audience="authenticated",
            issuer=ISSUER,
            options={
                "verify_signature": True,
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
                "require": ["sub", "exp", "aud", "iss"]
            }
        )

        return TokenData(
            sub=payload.get("sub"),
            email=payload.get("email")
        )

    except (jwt.PyJWKClientConnectionError, httpx.HTTPError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable."
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.InvalidTokenError, jwt.PyJWKClientError, ValidationError, ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(token_data: TokenData = Depends(verify_token)) -> TokenData:
    """
    FastAPI dependency to get the currently authenticated user's base identity.
    Use this to extract the 'sub' (UUID), which should then be used in a separate 
    database dependency to load the user's Profile and application roles.
    """
    return token_data
