"""
Projetos: criar, editar, listar e encerrar.

A autorização (só o responsável edita/encerra) fica na API (api/projects.py), que compara
`project.owner_id` com o usuário autenticado. Aqui ficam as regras do próprio projeto:
- projeto encerrado (CLOSED) não pode mais ser editado nem encerrado de novo;
- encerrar o projeto encerra junto as vagas que ainda estavam abertas.
"""
from sqlmodel import col, select, update

from integration.database import SessionDep
from models import (Profile, Project, ProjectOwner, ProjectRead, ProjectStatus, ProjectWrite, User, Vacancy,
                    VacancyStatus)
from models.common import utcnow
from services.vacancy_service import project_vacancy_summaries

PROJECT_FIELDS = {"title", "description", "github_url"}


class ProjectClosedError(Exception):
    """O projeto já está encerrado (não aceita edição nem novo encerramento)."""


def get_project(session: SessionDep, project_id: int) -> Project | None:
    return session.get(Project, project_id)


def _owners(session: SessionDep, owner_ids: set[int]) -> dict[int, ProjectOwner]:
    """Responsáveis de vários projetos em uma consulta (nome vem do perfil, se existir)."""
    if not owner_ids:
        return {}
    rows = session.exec(
        select(User.id, User.username, Profile.full_name)
        .join(Profile, Profile.user_id == User.id, isouter=True)
        .where(col(User.id).in_(owner_ids))
    ).all()
    return {user_id: ProjectOwner(id=user_id, username=username, full_name=full_name)
            for user_id, username, full_name in rows}


def to_project_reads(session: SessionDep, projects: list[Project]) -> list[ProjectRead]:
    owners = _owners(session, {project.owner_id for project in projects})
    summaries = project_vacancy_summaries(session, projects)
    reads = []
    for project in projects:
        open_vacancies, technologies = summaries.get(project.id, (0, []))
        reads.append(ProjectRead(
            **project.model_dump(include=PROJECT_FIELDS | {"id", "status", "created_at", "updated_at"}),
            owner=owners[project.owner_id],
            open_vacancies=open_vacancies,
            technologies=technologies,
        ))
    return reads


def to_project_read(session: SessionDep, project: Project) -> ProjectRead:
    return to_project_reads(session, [project])[0]


def list_projects(
    session: SessionDep, *, status: ProjectStatus | None = None, skip: int = 0, limit: int = 20
) -> list[ProjectRead]:
    """Mais recentes primeiro; `status` filtra abertos/encerrados."""
    statement = select(Project)
    if status is not None:
        statement = statement.where(Project.status == status)
    statement = statement.order_by(col(Project.created_at).desc(), col(Project.id).desc()).offset(skip).limit(limit)
    return to_project_reads(session, list(session.exec(statement).all()))


def list_owned_projects(session: SessionDep, user: User) -> list[ProjectRead]:
    """Projetos de que o usuário é responsável (abertos e encerrados), mais recentes primeiro."""
    projects = session.exec(
        select(Project)
        .where(Project.owner_id == user.id)
        .order_by(col(Project.created_at).desc(), col(Project.id).desc())
    ).all()
    return to_project_reads(session, list(projects))


def create_project(session: SessionDep, user: User, data: ProjectWrite) -> Project:
    project = Project(owner_id=user.id, **data.model_dump(include=PROJECT_FIELDS))
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def update_project(session: SessionDep, project: Project, data: ProjectWrite) -> Project:
    if project.status == ProjectStatus.CLOSED:
        raise ProjectClosedError()
    for key, value in data.model_dump(include=PROJECT_FIELDS).items():
        setattr(project, key, value)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def close_project(session: SessionDep, project: Project) -> Project:
    """Encerra o projeto e, no mesmo commit, as vagas dele que ainda estavam abertas."""
    if project.status == ProjectStatus.CLOSED:
        raise ProjectClosedError()
    project.status = ProjectStatus.CLOSED
    session.add(project)
    session.exec(
        update(Vacancy)
        .where(Vacancy.project_id == project.id, Vacancy.status == VacancyStatus.OPEN)
        .values(status=VacancyStatus.CLOSED, updated_at=utcnow())
    )
    session.commit()
    session.refresh(project)
    return project
