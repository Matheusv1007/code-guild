"""Schemas dos dados públicos do GitHub guardados em profile.github_data (sem tabela própria)."""
from datetime import datetime

from sqlmodel import SQLModel


class GitHubProfile(SQLModel):
    login: str
    name: str | None = None
    avatar_url: str | None = None
    html_url: str
    bio: str | None = None
    public_repos: int = 0
    followers: int = 0
    following: int = 0


class GitHubRepository(SQLModel):
    name: str
    description: str | None = None
    html_url: str
    language: str | None = None
    stars: int = 0
    forks: int = 0
    updated_at: datetime | None = None


class GitHubLanguage(SQLModel):
    """Linguagem principal dos repositórios próprios: quantidade e % do total."""
    name: str
    repositories: int
    percentage: float


class GitHubData(SQLModel):
    profile: GitHubProfile
    repositories: list[GitHubRepository] = []
    languages: list[GitHubLanguage] = []


class GitHubRead(SQLModel):
    """
    Resposta de GET /me/github e POST /me/github/refresh.

    - username: github_username salvo no perfil (null se não informado);
    - data/updated_at: última consulta salva (null se nunca consultado);
    - next_refresh_at: a partir de quando uma nova atualização é aceita (null = já pode).
    """
    username: str | None = None
    data: GitHubData | None = None
    updated_at: datetime | None = None
    next_refresh_at: datetime | None = None
