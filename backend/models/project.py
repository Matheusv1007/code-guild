from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

from .common import utcnow
from .enums import ProjectStatus

if TYPE_CHECKING:
    from .user import User
    from .vacancy import Vacancy


class ProjectBase(SQLModel):
    title: str = Field(max_length=120)
    description: str
    github_url: str | None = Field(default=None, max_length=255) 


class Project(ProjectBase, table=True):
    """
    Modelo que representa a tabela 'project' no banco de dados.

    Todo projeto tem um responsável (`owner_id`). Só ele cria e edita vagas e
    aprova ou rejeita candidatos (R2) — a autorização é feita na API comparando
    `owner_id` com o usuário autenticado. Não se apaga um usuário que ainda é
    responsável por projeto (ON DELETE RESTRICT).
    """
    id: int | None = Field(default=None, primary_key=True)
    status: ProjectStatus = Field(default=ProjectStatus.OPEN)
    owner_id: int = Field(foreign_key="user.id", index=True, ondelete="RESTRICT")
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow, sa_column_kwargs={"onupdate": utcnow})

    owner: "User" = Relationship()
    vacancies: list["Vacancy"] = Relationship(back_populates="project", cascade_delete=True)
