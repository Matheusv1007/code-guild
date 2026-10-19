"""
Dados públicos do GitHub no perfil técnico.

Os dados ficam salvos em profile.github_data com a data da consulta (github_updated_at):
- a leitura (GET /me/github) usa só o que está salvo e nunca chama o GitHub;
- a atualização (POST /me/github/refresh) é sob demanda e respeita um intervalo mínimo
  (REFRESH_COOLDOWN) para não gastar o limite da API;
- se o GitHub falhar, os dados salvos continuam intactos.
"""
from datetime import datetime, timedelta

from pydantic import ValidationError

from integration import github
from integration.database import SessionDep
from models import GitHubData, GitHubRead, Profile
from models.common import utcnow

REFRESH_COOLDOWN = timedelta(minutes=10)


class GitHubUsernameMissingError(Exception):
    """O perfil não tem github_username."""


class RefreshTooSoonError(Exception):
    """Última atualização há menos de REFRESH_COOLDOWN."""

    def __init__(self, next_refresh_at: datetime):
        super().__init__(next_refresh_at)
        self.next_refresh_at = next_refresh_at


def _next_refresh_at(profile: Profile) -> datetime | None:
    if profile.github_updated_at is None:
        return None
    next_refresh_at = profile.github_updated_at + REFRESH_COOLDOWN
    return next_refresh_at if next_refresh_at > utcnow() else None


def to_github_read(profile: Profile) -> GitHubRead:
    data = None
    if profile.github_data:
        try:
            data = GitHubData.model_validate(profile.github_data)
        except ValidationError:
            data = None  # formato antigo/corrompido: tratado como "nunca consultado"
    return GitHubRead(
        username=profile.github_username,
        data=data,
        updated_at=profile.github_updated_at if data else None,
        next_refresh_at=_next_refresh_at(profile) if data else None,
    )


def clear_github_data(profile: Profile) -> None:
    """Descarta os dados salvos (ex.: o usuário trocou ou removeu o github_username)."""
    profile.github_data = None
    profile.github_updated_at = None


def refresh_github_data(session: SessionDep, profile: Profile) -> Profile:
    """
    Consulta o GitHub e salva o resultado.
    Erros de github.fetch_github_data (GitHubError) sobem sem alterar o que está salvo.
    """
    if not profile.github_username:
        raise GitHubUsernameMissingError()
    next_refresh_at = _next_refresh_at(profile)
    if next_refresh_at:
        raise RefreshTooSoonError(next_refresh_at)

    profile.github_data = github.fetch_github_data(profile.github_username)
    profile.github_updated_at = utcnow()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile
