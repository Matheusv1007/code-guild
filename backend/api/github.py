import math

from fastapi import APIRouter, Depends, HTTPException, status
from integration.database import SessionDep
from integration.github import GitHubRateLimitError, GitHubUnavailableError, GitHubUserNotFoundError
from models import GitHubRead, User
from models.common import utcnow
from auth.dependencies import get_current_user
from api.profile import PROFILE_NOT_FOUND
from services import github_service, profile_service
from services.github_service import GitHubUsernameMissingError, RefreshTooSoonError

github_router = APIRouter(tags=["GitHub"])


def retry_after_header(moment) -> dict[str, str]:
    """Cabeçalho Retry-After (segundos) quando se sabe a partir de quando tentar de novo."""
    if moment is None:
        return {}
    return {"Retry-After": str(max(math.ceil((moment - utcnow()).total_seconds()), 1))}


def get_my_profile_or_404(session: SessionDep, current_user: User):
    profile = profile_service.get_profile(session, current_user)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=PROFILE_NOT_FOUND)
    return profile


@github_router.get("/me/github", response_model=GitHubRead)
def read_my_github(session: SessionDep, current_user: User = Depends(get_current_user)):
    """Dados do GitHub salvos no perfil. Não consulta o GitHub: funciona mesmo com ele fora do ar."""
    profile = get_my_profile_or_404(session, current_user)
    return github_service.to_github_read(profile)


@github_router.post("/me/github/refresh", response_model=GitHubRead)
def refresh_my_github(session: SessionDep, current_user: User = Depends(get_current_user)):
    """Consulta o GitHub agora e salva o resultado (no máximo uma vez a cada 10 minutos)."""
    profile = get_my_profile_or_404(session, current_user)
    try:
        profile = github_service.refresh_github_data(session, profile)
    except GitHubUsernameMissingError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Informe seu usuário do GitHub no perfil e salve antes de buscar os dados",
        )
    except RefreshTooSoonError as error:
        minutes = max(math.ceil((error.next_refresh_at - utcnow()).total_seconds() / 60), 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Os dados do GitHub foram atualizados há pouco. Tente novamente em {minutes} min",
            headers=retry_after_header(error.next_refresh_at),
        )
    except GitHubUserNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuário \"{profile.github_username}\" não encontrado no GitHub. Confira o username no perfil",
        )
    except GitHubRateLimitError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Limite de consultas ao GitHub atingido. Tente novamente mais tarde",
            headers=retry_after_header(error.reset_at),
        )
    except GitHubUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível consultar o GitHub agora. Tente novamente mais tarde",
        )
    return github_service.to_github_read(profile)
