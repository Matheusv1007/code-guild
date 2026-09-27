from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from .common import utcnow
from .enums import Level, TechnologyKind

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
