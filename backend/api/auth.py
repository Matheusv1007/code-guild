from fastapi import APIRouter, Depends, HTTPException, status
from integration.database import SessionDep
from models import Token, User, UserCreate, UserLogin, UserMe, UserRead
from auth.dependencies import get_current_user, require_registration_open
from services import auth_service, launch_service

auth_router = APIRouter(tags=["Autenticação"])

@auth_router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_registration_open)],
)
def register_user(user: UserCreate, session: SessionDep):
    db_user = auth_service.register_user(session, user)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username já registrado",
        )
    return db_user

@auth_router.post("/login", response_model=Token)
def login_for_access_token(session: SessionDep, user_login: UserLogin):
    try:
        access_token = auth_service.authenticate_user(session, user_login)
    except auth_service.AccessNotReleasedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=launch_service.access_not_released_message(),
        )
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"access_token": access_token, "token_type": "bearer"}

@auth_router.get("/me", response_model=UserMe)
def read_me(session: SessionDep, current_user: User = Depends(get_current_user)):
    """Retorna o usuário autenticado e, se existir, o perfil básico."""
    return auth_service.get_me(session, current_user)

@auth_router.get("/launch", tags=["Lançamento"])
def read_launch():
    """Data do lançamento (null = sem trava) e se a plataforma já está aberta a todos."""
    launch_at = launch_service.LAUNCH_AT
    return {
        "launch_at": launch_at.isoformat() if launch_at else None,
        "open": launch_service.is_launched(),
    }
