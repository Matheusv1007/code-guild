from fastapi import APIRouter, Depends, HTTPException, status
from integration.database import SessionDep
from models import User, UserCreate, UserRead, UserUpdate
from auth.dependencies import get_current_user, require_registration_open
from services import user_service

users_router = APIRouter(tags=["Usuários"])

def ensure_own_account(user_id: int, current_user: User) -> None:
    """Sem sistema de papéis ainda: cada usuário só pode ver/alterar/excluir a própria conta."""
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só tem acesso à sua própria conta",
        )

@users_router.post(
    "/users",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_registration_open)],
)
def create_user(
    *,
    session: SessionDep,
    user: UserCreate,
):
    try:
        return user_service.create_user(session, user)
    except user_service.AccountConflictError as conflict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=conflict.detail)

@users_router.get("/users/{user_id}", response_model=UserRead)
def read_user(
    *, session: SessionDep, user_id: int, current_user: User = Depends(get_current_user)
):
    ensure_own_account(user_id, current_user)
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
    try:
        user = user_service.update_user(session, user_id, user_update)
    except user_service.AccountConflictError as conflict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=conflict.detail)
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
