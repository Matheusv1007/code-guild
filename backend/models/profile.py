import unicodedata
from datetime import datetime
from typing import TYPE_CHECKING, Any

from pydantic import field_validator, model_validator
from sqlalchemy import JSON, Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from integration.github import USERNAME_PATTERN as GITHUB_USERNAME_PATTERN

from .common import utcnow
from .enums import Level, TechnologyKind
from .technology import TechnologyRead

if TYPE_CHECKING:
    from .technology import Technology
    from .user import User

BIO_MAX_LENGTH = 1000
INTERESTS_MAX_LENGTH = 500
FULL_NAME_MIN_VISIBLE = 2


def is_invisible(char: str) -> bool:
    """Espaço, separador ou caractere de controle/formatação (ex.: espaço de largura zero)."""
    return unicodedata.category(char)[0] in ("Z", "C")


def trim_invisible(value: str) -> str:
    """Tira das pontas o que `str.strip()` não tira: caracteres invisíveis como U+200B."""
    start, end = 0, len(value)
    while start < end and is_invisible(value[start]):
        start += 1
    while end > start and is_invisible(value[end - 1]):
        end -= 1
    return value[start:end]


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
    full_name: str = Field(max_length=120)
    mastered_technology_ids: list[int] = Field(default_factory=list)
    learning_technology_ids: list[int] = Field(default_factory=list)

    @field_validator("full_name", mode="before")
    @classmethod
    def check_full_name(cls, value):
        if not isinstance(value, str):
            return value
        value = trim_invisible(value)
        if sum(not is_invisible(char) for char in value) < FULL_NAME_MIN_VISIBLE:
            raise ValueError(f"O nome completo deve ter pelo menos {FULL_NAME_MIN_VISIBLE} caracteres visíveis")
        return value

    @field_validator("bio", "interests", "github_username", mode="before")
    @classmethod
    def blank_to_none(cls, value):
        if isinstance(value, str):
            return trim_invisible(value) or None
        return value

    @field_validator("bio")
    @classmethod
    def check_bio(cls, value):
        if value is not None and len(value) > BIO_MAX_LENGTH:
            raise ValueError(f"A bio pode ter no máximo {BIO_MAX_LENGTH} caracteres")
        return value

    @field_validator("interests")
    @classmethod
    def check_interests(cls, value):
        if value is not None and len(value) > INTERESTS_MAX_LENGTH:
            raise ValueError(f"Os interesses podem ter no máximo {INTERESTS_MAX_LENGTH} caracteres")
        return value

    @field_validator("github_username")
    @classmethod
    def check_github_username(cls, value):
        # Mesma regra usada na consulta ao GitHub: sem isso o erro só aparecia ao buscar os dados.
        if value is not None and not GITHUB_USERNAME_PATTERN.fullmatch(value):
            raise ValueError("O usuário do GitHub deve ter até 39 caracteres: letras, números e hífen, sem link ou @")
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
