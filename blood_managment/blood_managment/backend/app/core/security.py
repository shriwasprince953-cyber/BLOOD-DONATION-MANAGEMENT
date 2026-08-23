import logging
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, UUID4

from app.core.config import settings

logger = logging.getLogger(__name__)

# FastAPI dependency to extract the Bearer token from the Authorization header
security = HTTPBearer()

# Base URLs for Supabase Auth endpoints
supabase_url = settings.SUPABASE_URL.rstrip("/")
JWKS_URL = f"{supabase_url}/auth/v1/jwks"
ISSUER = f"{supabase_url}/auth/v1"

# PyJWKClient natively fetches and caches JWKS.
# It automatically handles key rotation by querying the endpoint again if an unknown 'kid' is encountered.
jwks_client = PyJWKClient(JWKS_URL)


class TokenData(BaseModel):
    """
    Schema for the extracted JWT payload.
    Application-specific roles (DONOR/ADMIN) are intentionally omitted here 
    to avoid confusion with Supabase's internal 'role' claim ('authenticated').
    Authorization will be resolved later by querying the 'profiles' table using 'sub'.
    """
    sub: UUID4
    email: Optional[str] = None


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> TokenData:
    """
    Verifies the asymmetric JWT issued by Supabase Auth.
    Defined as a standard `def` (instead of `async def`) so FastAPI natively 
    runs the potentially blocking JWKS network fetch in a background threadpool, 
    preventing any blocking of the main async event loop.
    """
    token = credentials.credentials

    try:
        # Dynamically retrieve the correct public signing key based on the token's 'kid' header
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and rigorously validate the token claims
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
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

    except jwt.PyJWKClientError as e:
        logger.error(f"Error fetching JWKS from Supabase: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to securely verify token signature."
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token presented: {e}")
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