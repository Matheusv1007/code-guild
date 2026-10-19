"""
Cliente da GitHub REST API (https://docs.github.com/pt/rest).

Só consulta dados públicos: perfil, repositórios e as linguagens desses repositórios.
Cada atualização faz 2 requisições (GET /users/{username} e GET /users/{username}/repos),
pois sem token o limite é de 60 requisições por hora por IP. As linguagens são contadas
a partir da linguagem principal de cada repositório, sem uma chamada extra por repositório.

Variáveis opcionais do .env:
- GITHUB_API_URL: padrão https://api.github.com
- GITHUB_TOKEN: token pessoal; só aumenta o limite (5.000 req/h). Nunca versionar.

Erros da API viram exceções deste módulo; quem chama decide o que mostrar ao usuário.
"""
import os
import re
from collections import Counter
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

load_dotenv()

GITHUB_API_URL = os.getenv("GITHUB_API_URL", "https://api.github.com").rstrip("/")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN") or None

TIMEOUT_SECONDS = 10
# Repositórios lidos para calcular as linguagens (máximo por página da API)
REPOS_PER_PAGE = 100
# Repositórios guardados para exibição (os atualizados mais recentemente)
TOP_REPOSITORIES = 6
# Mesmo formato aceito pelo GitHub e pela tela de perfil (scripts/perfil.js)
USERNAME_PATTERN = re.compile(r"[A-Za-z0-9-]{1,39}")


class GitHubError(Exception):
    """Base dos erros de integração com o GitHub."""


class GitHubUserNotFoundError(GitHubError):
    """O username não existe no GitHub."""


class GitHubRateLimitError(GitHubError):
    """Limite de requisições da API atingido."""

    def __init__(self, reset_at: datetime | None):
        super().__init__(reset_at)
        self.reset_at = reset_at


class GitHubUnavailableError(GitHubError):
    """GitHub fora do ar, lento demais, sem rede ou resposta inesperada."""


def _headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "CodeGuild",  # a API recusa requisições sem User-Agent
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return headers


def _rate_limit_reset(response: httpx.Response) -> datetime | None:
    reset = response.headers.get("x-ratelimit-reset")
    if reset and reset.isdigit():
        return datetime.fromtimestamp(int(reset), tz=timezone.utc)
    return None


def _get(client: httpx.Client, path: str, params: dict | None = None):
    try:
        response = client.get(path, params=params)
    except httpx.HTTPError as error:  # timeout, DNS, conexão recusada...
        raise GitHubUnavailableError(str(error)) from error

    if response.status_code == 404:
        raise GitHubUserNotFoundError()
    # 403 com o limite zerado ou 429: limite de requisições (primário ou secundário)
    if response.status_code == 429 or (
        response.status_code == 403 and response.headers.get("x-ratelimit-remaining") == "0"
    ):
        raise GitHubRateLimitError(_rate_limit_reset(response))
    if response.status_code != 200:
        raise GitHubUnavailableError(f"GitHub respondeu {response.status_code}")

    try:
        return response.json()
    except ValueError as error:
        raise GitHubUnavailableError("Resposta inválida do GitHub") from error


def _summarize_languages(repos: list[dict]) -> list[dict]:
    """Linguagem principal de cada repositório próprio (forks não contam), em % dos repositórios."""
    counter = Counter(repo["language"] for repo in repos if repo.get("language") and not repo.get("fork"))
    total = sum(counter.values())
    return [
        {"name": name, "repositories": count, "percentage": round(count * 100 / total, 1)}
        for name, count in counter.most_common()
    ]


def fetch_github_data(username: str) -> dict:
    """
    Consulta o perfil público, os repositórios e as linguagens de `username`.
    Devolve só os campos usados pelo CodeGuild, prontos para salvar em profile.github_data.
    """
    # O username entra na URL: fora do formato do GitHub, nem consulta.
    if not USERNAME_PATTERN.fullmatch(username):
        raise GitHubUserNotFoundError()

    with httpx.Client(base_url=GITHUB_API_URL, headers=_headers(), timeout=TIMEOUT_SECONDS) as client:
        user = _get(client, f"/users/{username}")
        repos = _get(
            client,
            f"/users/{username}/repos",
            params={"type": "owner", "sort": "pushed", "per_page": REPOS_PER_PAGE},
        )

    if not isinstance(user, dict) or not isinstance(repos, list):
        raise GitHubUnavailableError("Resposta inesperada do GitHub")

    return {
        "profile": {
            "login": user.get("login"),
            "name": user.get("name"),
            "avatar_url": user.get("avatar_url"),
            "html_url": user.get("html_url"),
            "bio": user.get("bio"),
            "public_repos": user.get("public_repos", 0),
            "followers": user.get("followers", 0),
            "following": user.get("following", 0),
        },
        "repositories": [
            {
                "name": repo.get("name"),
                "description": repo.get("description"),
                "html_url": repo.get("html_url"),
                "language": repo.get("language"),
                "stars": repo.get("stargazers_count", 0),
                "forks": repo.get("forks_count", 0),
                "updated_at": repo.get("pushed_at") or repo.get("updated_at"),
            }
            for repo in repos[:TOP_REPOSITORIES]
        ],
        "languages": _summarize_languages(repos),
    }
