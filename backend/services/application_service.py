"""
Candidaturas: candidatar-se, aprovar, rejeitar e cancelar.

A autorização fica na API (api/applications.py): só o responsável pelo projeto aprova ou rejeita,
só o candidato cancela. Regras daqui:
- só se candidata quem já criou o perfil técnico (é o que o responsável avalia);
- ninguém se candidata a vaga do próprio projeto;
- a vaga precisa aceitar candidaturas (vacancy_service.accepts_applications);
- uma candidatura ativa (PENDING ou APPROVED) por pessoa em cada vaga; depois de rejeitada
  ou cancelada, a pessoa pode se candidatar de novo;
- transições só a partir de PENDING: APPROVED ou REJECTED (responsável), CANCELED (candidato);
- aprovar trava a linha da vaga (SELECT ... FOR UPDATE) e confere se ainda há posição livre,
  para duas aprovações ao mesmo tempo não passarem da quantidade;
- vaga ou projeto encerrado: as PENDING continuam como estão, mas não podem mais ser aprovadas.
"""
from collections import defaultdict

from sqlalchemy.exc import IntegrityError
from sqlmodel import case, col, func, select

from integration.database import SessionDep
from models import (Application, ApplicationApplicant, ApplicationCreate, ApplicationRead, ApplicationStatus, Profile,
                    ProfileTechnology, Project, ProjectMember, Technology, TechnologyKind, TechnologyRead, User,
                    Vacancy)
from services.vacancy_service import accepts_applications

ACTIVE_STATUSES = (ApplicationStatus.PENDING, ApplicationStatus.APPROVED)


class ProfileRequiredError(Exception):
    """O usuário ainda não criou o perfil técnico."""


class OwnProjectError(Exception):
    """O usuário é o responsável pelo projeto da vaga."""


class VacancyNotAcceptingError(Exception):
    """Vaga encerrada, projeto encerrado ou sem posição livre."""


class AlreadyAppliedError(Exception):
    """Já existe candidatura PENDING ou APPROVED dessa pessoa para a vaga."""


class NotPendingError(Exception):
    """A candidatura já foi decidida ou cancelada."""


def get_application(session: SessionDep, application_id: int) -> Application | None:
    return session.get(Application, application_id)


def _approved_count(session: SessionDep, vacancy_id: int) -> int:
    return session.exec(
        select(func.count()).where(
            Application.vacancy_id == vacancy_id, Application.status == ApplicationStatus.APPROVED
        )
    ).one()


def apply(session: SessionDep, user: User, vacancy: Vacancy, data: ApplicationCreate) -> Application:
    if session.exec(select(Profile.id).where(Profile.user_id == user.id)).first() is None:
        raise ProfileRequiredError()
    project = vacancy.project
    if project.owner_id == user.id:
        raise OwnProjectError()
    if not accepts_applications(vacancy, project.status, _approved_count(session, vacancy.id)):
        raise VacancyNotAcceptingError()
    active = session.exec(
        select(Application.id).where(
            Application.vacancy_id == vacancy.id,
            Application.user_id == user.id,
            col(Application.status).in_(ACTIVE_STATUSES),
        )
    ).first()
    if active is not None:
        raise AlreadyAppliedError()

    application = Application(vacancy_id=vacancy.id, user_id=user.id, message=data.message)
    session.add(application)
    try:
        session.commit()
    except IntegrityError:
        # Dois envios ao mesmo tempo: o índice uq_application_active barra o segundo.
        session.rollback()
        raise AlreadyAppliedError()
    session.refresh(application)
    return application


def _set_status(session: SessionDep, application: Application, status: ApplicationStatus) -> Application:
    application.status = status
    session.add(application)
    session.commit()
    session.refresh(application)
    return application


def approve(session: SessionDep, application: Application) -> Application:
    if application.status != ApplicationStatus.PENDING:
        raise NotPendingError()
    vacancy = session.exec(select(Vacancy).where(Vacancy.id == application.vacancy_id).with_for_update()).one()
    if not accepts_applications(vacancy, vacancy.project.status, _approved_count(session, vacancy.id)):
        session.rollback()  # libera a trava da vaga
        raise VacancyNotAcceptingError()
    return _set_status(session, application, ApplicationStatus.APPROVED)


def reject(session: SessionDep, application: Application) -> Application:
    if application.status != ApplicationStatus.PENDING:
        raise NotPendingError()
    return _set_status(session, application, ApplicationStatus.REJECTED)


def cancel(session: SessionDep, application: Application) -> Application:
    if application.status != ApplicationStatus.PENDING:
        raise NotPendingError()
    return _set_status(session, application, ApplicationStatus.CANCELED)


def _applicants(session: SessionDep, user_ids: set[int]) -> dict[int, ApplicationApplicant]:
    """Candidatos com nome, nível, GitHub e tecnologias do perfil, em três consultas."""
    users = session.exec(select(User.id, User.username).where(col(User.id).in_(user_ids))).all()
    profiles = {
        profile.user_id: profile
        for profile in session.exec(select(Profile).where(col(Profile.user_id).in_(user_ids))).all()
    }
    technologies: dict[tuple[int, TechnologyKind], list[TechnologyRead]] = defaultdict(list)
    if profiles:
        rows = session.exec(
            select(ProfileTechnology.profile_id, ProfileTechnology.kind, Technology)
            .join(Technology, Technology.id == ProfileTechnology.technology_id)
            .where(col(ProfileTechnology.profile_id).in_([profile.id for profile in profiles.values()]))
            .order_by(Technology.name)
        ).all()
        for profile_id, kind, technology in rows:
            technologies[(profile_id, kind)].append(TechnologyRead.model_validate(technology))

    applicants = {}
    for user_id, username in users:
        profile = profiles.get(user_id)
        applicants[user_id] = ApplicationApplicant(
            id=user_id,
            username=username,
            full_name=profile.full_name if profile else None,
            level=profile.level if profile else None,
            github_username=profile.github_username if profile else None,
            mastered=technologies[(profile.id, TechnologyKind.MASTERED)] if profile else [],
            learning=technologies[(profile.id, TechnologyKind.LEARNING)] if profile else [],
        )
    return applicants


def to_application_reads(session: SessionDep, applications: list[Application]) -> list[ApplicationRead]:
    if not applications:
        return []
    vacancies = {
        vacancy.id: vacancy
        for vacancy in session.exec(
            select(Vacancy).where(col(Vacancy.id).in_({application.vacancy_id for application in applications}))
        ).all()
    }
    projects = {
        project.id: project
        for project in session.exec(
            select(Project).where(col(Project.id).in_({vacancy.project_id for vacancy in vacancies.values()}))
        ).all()
    }
    applicants = _applicants(session, {application.user_id for application in applications})

    reads = []
    for application in applications:
        vacancy = vacancies[application.vacancy_id]
        project = projects[vacancy.project_id]
        reads.append(ApplicationRead(
            id=application.id,
            status=application.status,
            message=application.message,
            vacancy_id=vacancy.id,
            vacancy_title=vacancy.title,
            vacancy_status=vacancy.status,
            project_id=project.id,
            project_title=project.title,
            project_status=project.status,
            applicant=applicants[application.user_id],
            created_at=application.created_at,
            updated_at=application.updated_at,
        ))
    return reads


def to_application_read(session: SessionDep, application: Application) -> ApplicationRead:
    return to_application_reads(session, [application])[0]


def list_user_applications(session: SessionDep, user: User) -> list[ApplicationRead]:
    """Candidaturas do usuário, mais recentes primeiro."""
    applications = session.exec(
        select(Application)
        .where(Application.user_id == user.id)
        .order_by(col(Application.created_at).desc(), col(Application.id).desc())
    ).all()
    return to_application_reads(session, list(applications))


def list_project_applications(session: SessionDep, project: Project) -> list[ApplicationRead]:
    """Candidaturas das vagas do projeto: pendentes, aprovadas e o resto; dentro de cada grupo, por ordem de envio."""
    status_order = case(
        (Application.status == ApplicationStatus.PENDING, 0),
        (Application.status == ApplicationStatus.APPROVED, 1),
        else_=2,
    )
    applications = session.exec(
        select(Application)
        .join(Vacancy, Vacancy.id == Application.vacancy_id)
        .where(Vacancy.project_id == project.id)
        .order_by(status_order, col(Application.created_at), col(Application.id))
    ).all()
    return to_application_reads(session, list(applications))


def list_project_members(session: SessionDep, project: Project) -> list[ProjectMember]:
    """Equipe do projeto: candidaturas aprovadas, na ordem em que as pessoas entraram."""
    rows = session.exec(
        select(User.id, User.username, Profile.full_name, Profile.level, Vacancy.id, Vacancy.title, Application.updated_at)
        .join(Vacancy, Vacancy.id == Application.vacancy_id)
        .join(User, User.id == Application.user_id)
        .join(Profile, Profile.user_id == User.id, isouter=True)
        .where(Vacancy.project_id == project.id, Application.status == ApplicationStatus.APPROVED)
        .order_by(col(Application.updated_at), col(Application.id))
    ).all()
    return [
        ProjectMember(
            user_id=user_id, username=username, full_name=full_name, level=level,
            vacancy_id=vacancy_id, vacancy_title=vacancy_title, joined_at=joined_at,
        )
        for user_id, username, full_name, level, vacancy_id, vacancy_title, joined_at in rows
    ]
