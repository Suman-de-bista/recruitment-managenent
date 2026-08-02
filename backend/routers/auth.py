from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.utils import clear_auth_cookie, create_access_token, get_current_user, hash_password, set_auth_cookie, verify_password
from app.database import get_db
from app.models import User, UserRole
from app.schemas import Message, Token, UserLogin, UserRead, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Role is always hardcoded to "reviewer" here. UserRegister has no
    # `role` field at all, so there is nothing a client could send to
    # override this.
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.REVIEWER.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(subject=str(user.id), claims={"role": user.role})
    set_auth_cookie(response, token)
    # access_token is still returned in the body for curl/API use (see
    # README examples); the frontend relies on the httpOnly cookie instead
    # and never reads this field.
    return Token(access_token=token, user=user)


@router.post("/logout", response_model=Message)
def logout(response: Response):
    clear_auth_cookie(response)
    return Message(detail="Logged out")


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
