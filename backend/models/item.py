from sqlmodel import Field, SQLModel

class ItemBase(SQLModel):
    """Classe base contendo os atributos comuns a todos os modelos de 'Item'."""
    name: str = Field(index=True)
    description: str | None = Field(default=None)
    price: float
    is_active: bool = Field(default=True)

class Item(ItemBase, table=True):
    """Modelo que representa a tabela 'item' no banco de dados."""
    id: int | None = Field(default=None, primary_key=True)

class ItemCreate(ItemBase):
    """Modelo utilizado para validar os dados recebidos ao CRIAR um item (POST)."""
    pass

class ItemUpdate(SQLModel):
    """Modelo utilizado para validar os dados recebidos ao ATUALIZAR um item (PATCH)."""
    name: str | None = None
    description: str | None = None
    price: float | None = None
    is_active: bool | None = None
