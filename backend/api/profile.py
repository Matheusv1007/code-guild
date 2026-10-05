from fastapi import APIRouter, Depends, HTTPException, status
from integration.database import SessionDep
from models import ProfileRead, ProfileWrite, User
from auth.dependencies import get_current_user
from services import profile_service
from services.profile_service import InvalidTechnologiesError, ProfileAlreadyExistsError

profile_router = APIRouter(tags=["Perfil técnico"])

PROFILE_NOT_FOUND = "Perfil ainda não criado"

def invalid_technologies_exception(error: InvalidTechnologiesError) -> HTTPException:
    ids = ", ".join(str(i) for i in error.ids)
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=f"Tecnologia(s) inexistente(s) no catálogo (ids: {ids})",
    )

@profile_router.get("/me/profile", response_model=ProfileRead)
def read_my_profile(session: SessionDep, current_user: User = Depends(get_current_user)):
    """Perfil completo do usuário autenticado."""
    profile = profile_service.get_profile(session, current_user)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=PROFILE_NOT_FOUND)
    return profile_service.to_profile_read(session, profile)

@profile_router.post("/me/profile", response_model=ProfileRead, status_code=status.HTTP_201_CREATED)
def create_my_profile(
    *, session: SessionDep, data: ProfileWrite, current_user: User = Depends(get_current_user)
):
    """Cria o perfil do usuário autenticado (um por usuário)."""
    try:
        profile = profile_service.create_profile(session, current_user, data)
    except ProfileAlreadyExistsError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Perfil já existe; use PUT para editar")
    except InvalidTechnologiesError as error:
        raise invalid_technologies_exception(error)
    return profile_service.to_profile_read(session, profile)

@profile_router.put("/me/profile", response_model=ProfileRead)
def update_my_profile(
    *, session: SessionDep, data: ProfileWrite, current_user: User = Depends(get_current_user)
):
    """Substitui o perfil do usuário autenticado (campos e tecnologias)."""
    profile = profile_service.get_profile(session, current_user)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=PROFILE_NOT_FOUND)
    try:
        profile = profile_service.update_profile(session, profile, data)
    except InvalidTechnologiesError as error:
        raise invalid_technologies_exception(error)
    return profile_service.to_profile_read(session, profile)
