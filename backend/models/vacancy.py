from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint
from sqlmodel import Field, Relationship, SQLModel

from .common import utcnow
from .enums import Level, VacancyStatus
from .technology import Technology

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
