import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, UserRole

JWT_ALGORITHM = "HS256"
PASSWORD_ITERATIONS = 210_000
ACCESS_TOKEN_COOKIE_NAME = "access_token"

bearer_scheme = HTTPBearer(auto_error=False)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=ACCESS_TOKEN_COOKIE_NAME, path="/")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return (
        f"pbkdf2_sha256${PASSWORD_ITERATIONS}$"
        f"{base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"
    )


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = hashed_password.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64.encode())
        expected_digest = base64.b64decode(digest_b64.encode())
        actual_digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
    except (ValueError, TypeError):
        return False
    return secrets.compare_digest(actual_digest, expected_digest)


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _base64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def _sign(message: bytes) -> str:
    signature = hmac.new(settings.jwt_secret_key.encode(), message, hashlib.sha256).digest()
    return _base64url_encode(signature)


def create_access_token(subject: str, claims: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
    }
    if claims:
        payload.update(claims)

    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    encoded_header = _base64url_encode(json.dumps(header, separators=(",", ":"), sort_keys=True).encode())
    encoded_payload = _base64url_encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    return f"{encoded_header}.{encoded_payload}.{_sign(signing_input)}"


def decode_access_token(token: str) -> dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        encoded_header, encoded_payload, signature = token.split(".")
        signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
        if not hmac.compare_digest(signature, _sign(signing_input)):
            raise credentials_exception
        header = json.loads(_base64url_decode(encoded_header))
        payload = json.loads(_base64url_decode(encoded_payload))
    except (ValueError, json.JSONDecodeError):
        raise credentials_exception from None

    if header.get("alg") != JWT_ALGORITHM:
        raise credentials_exception

    expires_at = payload.get("exp")
    if not isinstance(expires_at, int) or expires_at < int(datetime.now(timezone.utc).timestamp()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    # An explicit Bearer header (curl, the API docs, tests) always wins when
    # present, since sending one is a deliberate act by the caller. Browser
    # requests from the frontend don't send one at all and rely purely on
    # the httpOnly cookie set on login.
    if credentials is not None and credentials.scheme.lower() == "bearer":
        token = credentials.credentials
    else:
        token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
        if token is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

    payload = decode_access_token(token)
    subject = payload.get("sub")
    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def is_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN.value


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
