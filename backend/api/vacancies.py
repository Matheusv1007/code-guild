from fastapi import APIRouter, Depends, HTTPException, status
from integration.database import SessionDep
from models import User, Vacancy, VacancyRead, VacancyWrite
from auth.dependencies import get_current_user
from api.projects import ensure_project_owner, get_owned_project, get_project_or_404
from api.profile import invalid_technologies_exception
from services import vacancy_service
from services.technology_service import InvalidTechnologiesError
from services.vacancy_service import ProjectNotOpenError, QuantityBelowFilledError, VacancyClosedError

vacancies_router = APIRouter(tags=["Vagas"])

PROJECT_NOT_OPEN = "Projeto encerrado: as vagas não podem mais ser alteradas"
VACANCY_CLOSED = "Vaga encerrada não pode ser alterada"


def get_owned_vacancy(session: SessionDep, vacancy_id: int, current_user: User) -> Vacancy:
    """Vaga existente cujo projeto pertence ao usuário autenticado (regra R2)."""
    vacancy = vacancy_service.get_vacancy(session, vacancy_id)
    if not vacancy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")
    ensure_project_owner(vacancy.project, current_user)
    return vacancy


@vacancies_router.get("/projects/{project_id}/vacancies", response_model=list[VacancyRead])
def read_project_vacancies(session: SessionDep, project_id: int):
    """Rota pública: vagas do projeto (abertas primeiro), com disponibilidade calculada."""
    project = get_project_or_404(session, project_id)
    return vacancy_service.list_project_vacancies(session, project)


@vacancies_router.post(
    "/projects/{project_id}/vacancies", response_model=VacancyRead, status_code=status.HTTP_201_CREATED
)
def create_vacancy(
    *, session: SessionDep, project_id: int, data: VacancyWrite, current_user: User = Depends(get_current_user)
):
    """Anuncia uma vaga (especialidade, stack e quantidade). Só o responsável; projeto precisa estar aberto."""
    project = get_owned_project(session, project_id, current_user)
    try:
        vacancy = vacancy_service.create_vacancy(session, project, data)
    except ProjectNotOpenError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=PROJECT_NOT_OPEN)
    except InvalidTechnologiesError as error:
        raise invalid_technologies_exception(error)
    return vacancy_service.to_vacancy_read(session, vacancy)


@vacancies_router.put("/vacancies/{vacancy_id}", response_model=VacancyRead)
def update_vacancy(
    *, session: SessionDep, vacancy_id: int, data: VacancyWrite, current_user: User = Depends(get_current_user)
):
    """Substitui a vaga (inclusive a stack). Só o responsável; vaga e projeto precisam estar abertos."""
    vacancy = get_owned_vacancy(session, vacancy_id, current_user)
    try:
        vacancy = vacancy_service.update_vacancy(session, vacancy, data)
    except ProjectNotOpenError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=PROJECT_NOT_OPEN)
    except VacancyClosedError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=VACANCY_CLOSED)
    except QuantityBelowFilledError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A vaga já tem {error.filled} candidatura(s) aprovada(s); a quantidade não pode ser menor",
        )
    except InvalidTechnologiesError as error:
        raise invalid_technologies_exception(error)
    return vacancy_service.to_vacancy_read(session, vacancy)


@vacancies_router.post("/vacancies/{vacancy_id}/close", response_model=VacancyRead)
def close_vacancy(*, session: SessionDep, vacancy_id: int, current_user: User = Depends(get_current_user)):
    """Encerra a vaga: ela deixa de aceitar candidaturas. Só o responsável; não há reabertura."""
    vacancy = get_owned_vacancy(session, vacancy_id, current_user)
    try:
        vacancy = vacancy_service.close_vacancy(session, vacancy)
    except ProjectNotOpenError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=PROJECT_NOT_OPEN)
    except VacancyClosedError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Vaga já está encerrada")
    return vacancy_service.to_vacancy_read(session, vacancy)
