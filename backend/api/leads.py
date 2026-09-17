from fastapi import APIRouter, Depends, HTTPException, status
from integration.database import SessionDep
from models import Lead, LeadCreate, LeadRead, User
from auth.dependencies import get_current_user
from services import lead_service

leads_router = APIRouter(tags=["Leads (Interessados)"])

@leads_router.post("/leads", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_lead(
    *,
    session: SessionDep,
    lead: LeadCreate,
):
    """Rota pública para cadastro na lista de interesse."""
    db_lead = lead_service.create_lead(session, lead)
    if not db_lead:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="E-mail já cadastrado na lista de interesse",
        )
    return db_lead

@leads_router.get("/leads", response_model=list[LeadRead])
def read_leads(
    session: SessionDep,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    """Rota protegida para listar os interessados capturados."""
    return lead_service.get_leads(session, skip=skip, limit=limit)
