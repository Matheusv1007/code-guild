from datetime import datetime
from typing import TYPE_CHECKING, Any

from pydantic import field_validator, model_validator
from sqlalchemy import JSON, Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from .common import utcnow
from .enums import Level, TechnologyKind
from .technology import TechnologyRead

if TYPE_CHECKING:
    from .technology import Technology
    from .user import User


class ProfileTechnology(SQLModel, table=True):

    __tablename__ = "profile_technology"

    profile_id: int = Field(foreign_key="profile.id", primary_key=True, ondelete="CASCADE")
    technology_id: int = Field(foreign_key="technology.id", primary_key=True, ondelete="CASCADE")
    kind: TechnologyKind = Field(primary_key=True)

    profile: "Profile" = Relationship(back_populates="technologies")
    technology: "Technology" = Relationship()


class ProfileBase(SQLModel):

    full_name: str = Field(max_length=120)
    bio: str | None = Field(default=None)
    level: Level
    interests: str | None = Field(default=None)  
    github_username: str | None = Field(default=None, max_length=39)  


class ProfileSummary(SQLModel):
    """Dados básicos do perfil devolvidos junto com o usuário em GET /me."""
    id: int
    full_name: str
    level: Level
    bio: str | None = None
    github_username: str | None = None


class ProfileWrite(ProfileBase):
    """Corpo de POST/PUT /me/profile: substitui o perfil inteiro, inclusive as tecnologias."""
    full_name: str = Field(min_length=1, max_length=120)
    mastered_technology_ids: list[int] = Field(default_factory=list)
    learning_technology_ids: list[int] = Field(default_factory=list)

    @field_validator("full_name", mode="before")
    @classmethod
    def strip_full_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("bio", "interests", "github_username", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("mastered_technology_ids", "learning_technology_ids")
    @classmethod
    def deduplicate(cls, value: list[int]) -> list[int]:
        return list(dict.fromkeys(value))

    @model_validator(mode="after")
    def check_kinds_do_not_overlap(self):
        overlap = set(self.mastered_technology_ids) & set(self.learning_technology_ids)
        if overlap:
            ids = ", ".join(str(i) for i in sorted(overlap))
            raise ValueError(f"Uma tecnologia não pode ser dominada e estudada ao mesmo tempo (ids: {ids})")
        return self


class ProfileRead(SQLModel):
    """Perfil completo do usuário autenticado (GET/POST/PUT /me/profile)."""
    id: int
    full_name: str
    level: Level
    bio: str | None = None
    interests: str | None = None
    github_username: str | None = None
    mastered: list[TechnologyRead] = []
    learning: list[TechnologyRead] = []
    created_at: datetime
    updated_at: datetime


class Profile(ProfileBase, table=True):
    
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True, ondelete="CASCADE")
    github_data: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON().with_variant(JSONB, "postgresql"))
    )
    github_updated_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow, sa_column_kwargs={"onupdate": utcnow})

    user: "User" = Relationship()
    technologies: list[ProfileTechnology] = Relationship(back_populates="profile", cascade_delete=True)

    @property
    def mastered(self) -> list["Technology"]:
        return [pt.technology for pt in self.technologies if pt.kind == TechnologyKind.MASTERED]

    @property
    def learning(self) -> list["Technology"]:
        return [pt.technology for pt in self.technologies if pt.kind == TechnologyKind.LEARNING]
