from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import field_validator
from sqlalchemy import Index, text
from sqlmodel import Field, Relationship, SQLModel

from .common import utcnow
from .enums import ApplicationStatus, Level, ProjectStatus, VacancyStatus
from .technology import TechnologyRead

if TYPE_CHECKING:
    from .user import User
    from .vacancy import Vacancy


class ApplicationBase(SQLModel):
    message: str | None = Field(default=None) 


class Application(ApplicationBase, table=True):
    # O índice garante no banco uma candidatura PENDING por pessoa por vaga. A regra completa
    # (PENDING ou APPROVED) fica em services/application_service.py: sem migrations, mudar o
    # índice aqui não altera bancos que já existem.
    __table_args__ = (
        Index(
            "uq_application_active",
            "vacancy_id",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    vacancy_id: int = Field(foreign_key="vacancy.id", index=True, ondelete="CASCADE")
    user_id: int = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    status: ApplicationStatus = Field(default=ApplicationStatus.PENDING)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow, sa_column_kwargs={"onupdate": utcnow})

    vacancy: "Vacancy" = Relationship(back_populates="applications")
    user: "User" = Relationship()


class ApplicationCreate(SQLModel):
    """Corpo de POST /vacancies/{id}/applications."""
    message: str | None = Field(default=None, max_length=1000)

    @field_validator("message", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class ApplicationApplicant(SQLModel):
    """Candidato com o resumo do perfil técnico, para o responsável avaliar antes de decidir."""
    id: int
    username: str
    full_name: str | None = None
    level: Level | None = None
    github_username: str | None = None
    mastered: list[TechnologyRead] = []
    learning: list[TechnologyRead] = []


class ApplicationRead(SQLModel):
    id: int
    status: ApplicationStatus
    message: str | None = None
    vacancy_id: int
    vacancy_title: str
    vacancy_status: VacancyStatus
    project_id: int
    project_title: str
    project_status: ProjectStatus
    applicant: ApplicationApplicant
    created_at: datetime
    updated_at: datetime


class ProjectMember(SQLModel):
    """Participante do projeto: candidatura aprovada (uma linha por vaga ocupada). Dados públicos, sem e-mail."""
    user_id: int
    username: str
    full_name: str | None = None
    level: Level | None = None
    vacancy_id: int
    vacancy_title: str
    joined_at: datetime
