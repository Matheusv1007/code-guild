"""
Trava de lançamento da plataforma.

Antes de LAUNCH_AT o cadastro fica fechado (visitantes usam o pré-cadastro da landing)
e só as contas em EARLY_ACCESS_USER_IDS (equipe) conseguem entrar. Contas criadas
antes da trava continuam no banco e entram normalmente a partir de LAUNCH_AT.

Sem LAUNCH_AT (ambiente local) não há trava.
"""
import os
from datetime import datetime, timezone

from dotenv import load_dotenv

from models import User

load_dotenv()


def _parse_launch_at(value: str) -> datetime | None:
    if not value:
        return None
    launch_at = datetime.fromisoformat(value)
    if launch_at.tzinfo is None:
        raise RuntimeError("LAUNCH_AT precisa do fuso horário, ex.: 2026-12-01T19:00:00-03:00")
    return launch_at


def _parse_user_ids(value: str) -> frozenset[int]:
    return frozenset(int(item) for item in value.split(",") if item.strip())


LAUNCH_AT = _parse_launch_at(os.getenv("LAUNCH_AT", "").strip())
EARLY_ACCESS_USER_IDS = _parse_user_ids(os.getenv("EARLY_ACCESS_USER_IDS", ""))


def is_launched() -> bool:
    return LAUNCH_AT is None or datetime.now(timezone.utc) >= LAUNCH_AT


def has_access(user: User) -> bool:
    return is_launched() or user.id in EARLY_ACCESS_USER_IDS


def _launch_label() -> str:
    """Data no fuso informado em LAUNCH_AT, ex.: "01/12/2026 às 19:00"."""
    return LAUNCH_AT.strftime("%d/%m/%Y às %H:%M")


def registration_closed_message() -> str:
    return f"O cadastro abre em {_launch_label()}. Faça seu pré-cadastro na página inicial para ser avisado."


def access_not_released_message() -> str:
    return f"Sua conta está garantida! O acesso à plataforma será liberado em {_launch_label()}."
