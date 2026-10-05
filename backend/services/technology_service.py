from sqlmodel import select
from integration.database import SessionDep
from models import Technology

def get_technologies(session: SessionDep) -> list[Technology]:
    return session.exec(select(Technology).order_by(Technology.name)).all()
