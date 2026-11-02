from datetime import datetime
from typing import TYPE_CHECKING

from pydantic import field_validator
from sqlalchemy import CheckConstraint
from sqlmodel import Field, Relationship, SQLModel

from .common import utcnow
from .enums import Level, VacancyStatus
from .technology import Technology, TechnologyRead

if TYPE_CHECKING:
    from .application import Application
    from .project import Project


class VacancyTechnology(SQLModel, table=True):
   
    __tablename__ = "vacancy_technology"

    vacancy_id: int = Field(foreign_key="vacancy.id", primary_key=True, ondelete="CASCADE")
    technology_id: int = Field(foreign_key="technology.id", primary_key=True, ondelete="CASCADE")


class VacancyBase(SQLModel):
    title: str = Field(max_length=120)  # especialidade ou stack, ex.: "Backend Developer"
    description: str | None = Field(default=None)
    quantity: int = Field(default=1, gt=0)  # quantas posições a vaga abre
    level: Level | None = Field(default=None)  # nível recomendado; None = qualquer nível


class Vacancy(VacancyBase, table=True):
    
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_vacancy_quantity_positive"),)

    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True, ondelete="CASCADE")
    status: VacancyStatus = Field(default=VacancyStatus.OPEN)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow, sa_column_kwargs={"onupdate": utcnow})

    project: "Project" = Relationship(back_populates="vacancies")
    technologies: list[Technology] = Relationship(link_model=VacancyTechnology)
    applications: list["Application"] = Relationship(back_populates="vacancy", cascade_delete=True)


class VacancyWrite(VacancyBase):
    """Corpo de POST /projects/{id}/vacancies e PUT /vacancies/{id}: substitui a vaga inteira, inclusive a stack."""
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    quantity: int = Field(default=1, ge=1, le=50)
    technology_ids: list[int] = Field(default_factory=list)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("technology_ids")
    @classmethod
    def deduplicate(cls, value: list[int]) -> list[int]:
        return list(dict.fromkeys(value))


class VacancyRead(SQLModel):
    """
    Vaga com a disponibilidade calculada:
    - `filled`: candidaturas aprovadas; `available` = quantity - filled (nunca negativo);
    - `accepts_applications`: vaga e projeto abertos e com posição livre (regra: vaga encerrada
      ou sem disponibilidade não aceita novas candidaturas).
    """
    id: int
    project_id: int
    title: str
    description: str | None = None
    quantity: int
    level: Level | None = None
    status: VacancyStatus
    technologies: list[TechnologyRead] = []
    filled: int
    available: int
    accepts_applications: bool
    created_at: datetime
    updated_at: datetime
