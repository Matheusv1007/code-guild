from datetime import datetime
from sqlmodel import Field, SQLModel

class LeadBase(SQLModel):
    name: str
    email: str = Field(index=True, unique=True)
    course_period: str
    areas_of_interest: str

class Lead(LeadBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LeadCreate(LeadBase):
    pass

class LeadRead(LeadBase):
    id: int
    created_at: datetime
