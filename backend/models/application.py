from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Index, text
from sqlmodel import Field, Relationship, SQLModel

from .common import utcnow
from .enums import ApplicationStatus

if TYPE_CHECKING:
    from .user import User
    from .vacancy import Vacancy


class ApplicationBase(SQLModel):
    message: str | None = Field(default=None) 


class Application(ApplicationBase, table=True):
  
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

    @property
    def is_active(self) -> bool:
        return self.status == ApplicationStatus.PENDING
