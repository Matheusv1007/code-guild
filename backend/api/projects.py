from fastapi import APIRouter, Depends, HTTPException, Query, status
from integration.database import SessionDep
from models import Project, ProjectRead, ProjectStatus, ProjectWrite, User
from auth.dependencies import get_current_user
from services import project_service
from services.project_service import ProjectClosedError

projects_router = APIRouter(tags=["Projetos"])

PROJECT_CLOSED = "Projeto encerrado não pode ser alterado"


def get_project_or_404(session: SessionDep, project_id: int) -> Project:
    project = project_service.get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projeto não encontrado")
    return project


def ensure_project_owner(project: Project, current_user: User) -> None:
    """Regra R2: só o responsável gerencia o projeto (e, depois, as vagas e candidaturas dele)."""
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas o responsável pelo projeto pode fazer esta alteração",
        )


def get_owned_project(session: SessionDep, project_id: int, current_user: User) -> Project:
    project = get_project_or_404(session, project_id)
    ensure_project_owner(project, current_user)
    return project


@projects_router.get("/projects", response_model=list[ProjectRead])
def read_projects(
    session: SessionDep,
    status_filter: ProjectStatus | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Rota pública: mural de projetos, mais recentes primeiro (paginado; `status` opcional)."""
    return project_service.list_projects(session, status=status_filter, skip=skip, limit=limit)


@projects_router.get("/projects/{project_id}", response_model=ProjectRead)
def read_project(session: SessionDep, project_id: int):
    """Rota pública: detalhes de um projeto (aberto ou encerrado)."""
    return project_service.to_project_read(session, get_project_or_404(session, project_id))


@projects_router.get("/me/projects", response_model=list[ProjectRead])
def read_my_projects(session: SessionDep, current_user: User = Depends(get_current_user)):
    """Projetos de que o usuário autenticado é responsável (abertos e encerrados)."""
    return project_service.list_owned_projects(session, current_user)


@projects_router.post("/projects", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(*, session: SessionDep, data: ProjectWrite, current_user: User = Depends(get_current_user)):
    """Cria um projeto; o usuário autenticado vira o responsável."""
    project = project_service.create_project(session, current_user, data)
    return project_service.to_project_read(session, project)


@projects_router.put("/projects/{project_id}", response_model=ProjectRead)
def update_project(
    *, session: SessionDep, project_id: int, data: ProjectWrite, current_user: User = Depends(get_current_user)
):
    """Substitui título, descrição e link do GitHub. Só o responsável; projeto precisa estar aberto."""
    project = get_owned_project(session, project_id, current_user)
    try:
        project = project_service.update_project(session, project, data)
    except ProjectClosedError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=PROJECT_CLOSED)
    return project_service.to_project_read(session, project)


@projects_router.post("/projects/{project_id}/close", response_model=ProjectRead)
def close_project(*, session: SessionDep, project_id: int, current_user: User = Depends(get_current_user)):
    """Encerra o projeto (e as vagas abertas dele). Só o responsável; não há reabertura."""
    project = get_owned_project(session, project_id, current_user)
    try:
        project = project_service.close_project(session, project)
    except ProjectClosedError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Projeto já está encerrado")
    return project_service.to_project_read(session, project)
