from sqlmodel import col, select
from integration.database import SessionDep
from models import Technology


class InvalidTechnologiesError(Exception):
    """Algum id de tecnologia não existe no catálogo."""

    def __init__(self, ids: list[int]):
        super().__init__(ids)
        self.ids = ids


def get_technologies(session: SessionDep) -> list[Technology]:
    return session.exec(select(Technology).order_by(Technology.name)).all()


def ensure_technologies_exist(session: SessionDep, technology_ids: set[int]) -> None:
    """Valida ids do catálogo (perfil e vagas) antes de gravar vínculos."""
    if not technology_ids:
        return
    found = set(session.exec(select(Technology.id).where(col(Technology.id).in_(technology_ids))).all())
    missing = sorted(technology_ids - found)
    if missing:
        raise InvalidTechnologiesError(missing)
