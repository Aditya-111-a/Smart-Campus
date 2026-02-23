from datetime import datetime, timedelta
from typing import Optional
import logging

from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User, UserRole
from app.schemas import TokenData

# -------------------------------------------------------------------
# Logging (TEMP DEBUG – DO NOT REMOVE UNTIL SYSTEM IS STABLE)
# -------------------------------------------------------------------
logger = logging.getLogger("auth")
logging.basicConfig(level=logging.INFO)

# -------------------------------------------------------------------
# OAuth2 scheme
# -------------------------------------------------------------------
# IMPORTANT: tokenUrl MUST match your router prefix
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# -------------------------------------------------------------------
# Password hashing (bcrypt – unchanged, compatible with your DB)
# -------------------------------------------------------------------
def get_password_hash(password: str) -> str:
    """
    Hash password using bcrypt directly.
    This is intentionally NOT passlib-based to remain DB-compatible.
    """
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password using bcrypt directly.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception as e:
        logger.error(f"[AUTH] Password verification failed: {e}")
        return False


# -------------------------------------------------------------------
# JWT creation
# -------------------------------------------------------------------
def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.

    `data` should at least contain:
      - sub: user email
      - role: user's role (admin/user)
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.access_token_expire_minutes
        )

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=settings.algorithm
    )

    logger.info(
        "[AUTH] Access token created",
        extra={
            "sub": data.get("sub"),
            "role": data.get("role"),
            "expires_at": expire.isoformat() + "Z",
        },
    )

    return encoded_jwt


# -------------------------------------------------------------------
# Core dependency: get current user from JWT
# -------------------------------------------------------------------
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Extract user from Authorization: Bearer <token>
    """

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    logger.info("[AUTH] Incoming request – validating JWT")

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm]
        )

        email: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        exp: Optional[int] = payload.get("exp")

        if email is None:
            logger.warning("[AUTH] Token missing 'sub'")
            raise credentials_exception

        logger.info(
            "[AUTH] Token decoded successfully",
            extra={
                "email": email,
                "role": role,
                "exp": exp,
            },
        )

        token_data = TokenData(email=email)

    except JWTError as e:
        logger.error(f"[AUTH] JWT decode failed: {e}")
        raise credentials_exception

    user = db.query(User).filter(User.email == token_data.email).first()

    if user is None:
        logger.warning(
            f"[AUTH] No user found for email={token_data.email}"
        )
        raise credentials_exception

    logger.info(
        "[AUTH] Authenticated user",
        extra={
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        },
    )

    return user


# -------------------------------------------------------------------
# Active user guard
# -------------------------------------------------------------------
async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_active:
        logger.warning(
            f"[AUTH] Inactive user attempted access: {current_user.email}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


# -------------------------------------------------------------------
# Admin-only guard
# -------------------------------------------------------------------
async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    if current_user.role != UserRole.ADMIN:
        logger.warning(
            f"[AUTH] Forbidden admin access attempt by "
            f"user={current_user.email}, role={current_user.role}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    logger.info(
        f"[AUTH] Admin access granted to user={current_user.email}"
    )

    return current_user