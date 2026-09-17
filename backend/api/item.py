from fastapi import APIRouter, Depends, HTTPException, status
from integration.database import SessionDep
from models import Item, ItemCreate, ItemUpdate, User
from auth.dependencies import get_current_user
from services import item_service

app_router = APIRouter()

@app_router.post("/items/", response_model=Item, status_code=status.HTTP_201_CREATED)
def create_item(
    *,
    session: SessionDep,
    item: ItemCreate,
    current_user: User = Depends(get_current_user),  # noqa: B008
):
    return item_service.create_item(session, item)

@app_router.get("/items/", response_model=list[Item])
def read_items(
    session: SessionDep,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    return item_service.get_items(session, skip=skip, limit=limit)

@app_router.get("/items/{item_id}", response_model=Item)
def read_item(
    *, session: SessionDep, item_id: int, current_user: User = Depends(get_current_user)
):
    item = item_service.get_item(session, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado"
        )
    return item

@app_router.patch("/items/{item_id}", response_model=Item)
def update_item(
    *,
    session: SessionDep,
    item_id: int,
    item_update: ItemUpdate,
    current_user: User = Depends(get_current_user),
):
    item = item_service.update_item(session, item_id, item_update)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado"
        )
    return item

@app_router.delete("/items/{item_id}")
def delete_item(
    *, session: SessionDep, item_id: int, current_user: User = Depends(get_current_user)
):
    success = item_service.delete_item(session, item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item não encontrado"
        )
    return {"ok": True, "message": "Item deletado com sucesso"}
