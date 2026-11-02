import re
from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import field_validator
from sqlmodel import Field, Relationship, SQLModel

from .common import utcnow
from .enums import ProjectStatus
from .technology import TechnologyRead

if TYPE_CHECKING:
    from .user import User
    from .vacancy import Vacancy

# Repositório (https://github.com/dono/repo) ou perfil/organização (https://github.com/dono).
GITHUB_URL_PATTERN = re.compile(r"^https://github\.com/[A-Za-z0-9-]+(/[A-Za-z0-9._-]+)?/?$")


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


class ProjectWrite(ProjectBase):
    """Corpo de POST /projects e PUT /projects/{id}: substitui todos os campos editáveis."""
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=5000)

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("github_url", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("github_url")
    @classmethod
    def check_github_url(cls, value: str | None) -> str | None:
        if value is not None and not GITHUB_URL_PATTERN.match(value):
            raise ValueError("Informe um link do GitHub no formato https://github.com/usuario/repositorio")
        return value


class ProjectOwner(SQLModel):
    """Responsável pelo projeto: nome do perfil (se houver) e username."""
    id: int
    username: str
    full_name: str | None = None


class ProjectRead(SQLModel):
    """
    Projeto com o resumo das vagas:
    - `open_vacancies`: vagas que aceitam candidaturas agora (abertas e com posição livre);
    - `technologies`: stack pedida por essas vagas, sem repetição, em ordem alfabética.
    """
    id: int
    title: str
    description: str
    github_url: str | None = None
    status: ProjectStatus
    owner: ProjectOwner
    open_vacancies: int = 0
    technologies: list[TechnologyRead] = []
    created_at: datetime
    updated_at: datetime
