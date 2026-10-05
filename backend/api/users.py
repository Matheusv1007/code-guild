from fastapi import APIRouter, Depends, HTTPException, status
from integration.database import SessionDep
from models import User, UserCreate, UserRead, UserUpdate
from auth.dependencies import get_current_user
from services import user_service

users_router = APIRouter(tags=["Usuários"])

def ensure_own_account(user_id: int, current_user: User) -> None:
    """Sem sistema de papéis ainda: cada usuário só pode alterar/excluir a própria conta."""
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só pode alterar a sua própria conta",
        )

@users_router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    *,
    session: SessionDep,
    user: UserCreate,
):
    db_user = user_service.create_user(session, user)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username já registrado",
        )
    return db_user

@users_router.get("/users", response_model=list[UserRead])
def read_users(
    session: SessionDep,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    return user_service.get_users(session, skip=skip, limit=limit)

@users_router.get("/users/{user_id}", response_model=UserRead)
def read_user(
    *, session: SessionDep, user_id: int, current_user: User = Depends(get_current_user)
):
    user = user_service.get_user(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado"
        )
    return user

@users_router.put("/users/{user_id}", response_model=UserRead)
def update_user(
    *,
    session: SessionDep,
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
):
    ensure_own_account(user_id, current_user)
    user = user_service.update_user(session, user_id, user_update)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado"
        )
    return user

@users_router.delete("/users/{user_id}")
def delete_user(
    *, session: SessionDep, user_id: int, current_user: User = Depends(get_current_user)
):
    ensure_own_account(user_id, current_user)
    success = user_service.delete_user(session, user_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado"
        )
    return {"ok": True, "message": "Usuário deletado com sucesso"}
