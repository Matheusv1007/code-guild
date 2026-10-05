from fastapi import APIRouter
from integration.database import SessionDep
from models import TechnologyRead
from services import technology_service

technologies_router = APIRouter(tags=["Tecnologias"])

@technologies_router.get("/technologies", response_model=list[TechnologyRead])
def read_technologies(session: SessionDep):
    """Rota pública com o catálogo de tecnologias, em ordem alfabética."""
    return technology_service.get_technologies(session)
