from fastapi import APIRouter, HTTPException, status
from integration.database import SessionDep
from models import Lead, LeadCreate, LeadRead
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
