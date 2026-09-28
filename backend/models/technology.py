from sqlmodel import Field, SQLModel


class TechnologyBase(SQLModel):
   
    name: str = Field(max_length=60, unique=True, index=True)


class Technology(TechnologyBase, table=True):

    id: int | None = Field(default=None, primary_key=True)
