from fastapi import APIRouter, Depends, HTTPException, status
from integration.database import SessionDep
from models import Application, ApplicationCreate, ApplicationRead, User
from auth.dependencies import get_current_user
from api.projects import ensure_project_owner, get_owned_project
from services import application_service, vacancy_service
from services.application_service import (AlreadyAppliedError, NotPendingError, OwnProjectError, ProfileRequiredError,
                                          VacancyNotAcceptingError)

applications_router = APIRouter(tags=["Candidaturas"])

NOT_PENDING = "A candidatura já foi decidida ou cancelada"


def get_application_or_404(session: SessionDep, application_id: int) -> Application:
    application = application_service.get_application(session, application_id)
    if not application:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidatura não encontrada")
    return application


def get_owned_application(session: SessionDep, application_id: int, current_user: User) -> Application:
    """Candidatura de uma vaga cujo projeto pertence ao usuário autenticado (regra R2)."""
    application = get_application_or_404(session, application_id)
    ensure_project_owner(application.vacancy.project, current_user)
    return application


@applications_router.post(
    "/vacancies/{vacancy_id}/applications", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED
)
def create_application(
    *, session: SessionDep, vacancy_id: int, data: ApplicationCreate, current_user: User = Depends(get_current_user)
):
    """Candidata o usuário autenticado à vaga (com mensagem opcional)."""
    vacancy = vacancy_service.get_vacancy(session, vacancy_id)
    if not vacancy:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vaga não encontrada")
    try:
        application = application_service.apply(session, current_user, vacancy, data)
    except ProfileRequiredError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Crie seu perfil técnico antes de se candidatar"
        )
    except OwnProjectError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Você é o responsável por este projeto"
        )
    except VacancyNotAcceptingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Esta vaga não aceita candidaturas no momento"
        )
    except AlreadyAppliedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Você já tem uma candidatura ativa para esta vaga"
        )
    return application_service.to_application_read(session, application)


@applications_router.get("/me/applications", response_model=list[ApplicationRead])
def read_my_applications(session: SessionDep, current_user: User = Depends(get_current_user)):
    """Candidaturas do usuário autenticado, mais recentes primeiro."""
    return application_service.list_user_applications(session, current_user)


@applications_router.get("/projects/{project_id}/applications", response_model=list[ApplicationRead])
def read_project_applications(
    session: SessionDep, project_id: int, current_user: User = Depends(get_current_user)
):
    """Candidaturas de todas as vagas do projeto, com o perfil de cada candidato. Só o responsável."""
    project = get_owned_project(session, project_id, current_user)
    return application_service.list_project_applications(session, project)


@applications_router.post("/applications/{application_id}/approve", response_model=ApplicationRead)
def approve_application(
    *, session: SessionDep, application_id: int, current_user: User = Depends(get_current_user)
):
    """Aprova a candidatura: a pessoa entra na equipe e ocupa uma posição da vaga. Só o responsável."""
    application = get_owned_application(session, application_id, current_user)
    try:
        application = application_service.approve(session, application)
    except NotPendingError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=NOT_PENDING)
    except VacancyNotAcceptingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="A vaga está encerrada ou não tem mais posição livre"
        )
    return application_service.to_application_read(session, application)


@applications_router.post("/applications/{application_id}/reject", response_model=ApplicationRead)
def reject_application(
    *, session: SessionDep, application_id: int, current_user: User = Depends(get_current_user)
):
    """Rejeita a candidatura. Só o responsável."""
    application = get_owned_application(session, application_id, current_user)
    try:
        application = application_service.reject(session, application)
    except NotPendingError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=NOT_PENDING)
    return application_service.to_application_read(session, application)


@applications_router.post("/applications/{application_id}/cancel", response_model=ApplicationRead)
def cancel_application(
    *, session: SessionDep, application_id: int, current_user: User = Depends(get_current_user)
):
    """Cancela a própria candidatura enquanto ela está pendente."""
    application = get_application_or_404(session, application_id)
    if application.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Só quem se candidatou pode cancelar a candidatura"
        )
    try:
        application = application_service.cancel(session, application)
    except NotPendingError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=NOT_PENDING)
    return application_service.to_application_read(session, application)
