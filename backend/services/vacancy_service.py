"""
Vagas de um projeto: criar, editar, listar e encerrar.

A autorização (só o responsável pelo projeto) fica na API (api/vacancies.py). Regras daqui:
- vaga só é criada/editada/encerrada com o projeto aberto;
- vaga encerrada não é editada nem encerrada de novo (não há reabertura);
- `quantity` não pode ficar abaixo das candidaturas já aprovadas (`filled`);
- `accepts_applications`: vaga encerrada ou sem disponibilidade não aceita novas candidaturas.
  É a mesma função que o fluxo de candidaturas deve usar para validar uma nova candidatura.
"""
from collections import defaultdict

from sqlmodel import col, delete, func, select

from integration.database import SessionDep
from models import (Application, ApplicationStatus, Project, ProjectStatus, Technology, TechnologyRead, Vacancy,
                    VacancyRead, VacancyStatus, VacancyTechnology, VacancyWrite)
from models.common import utcnow
from services.technology_service import ensure_technologies_exist

VACANCY_FIELDS = {"title", "description", "quantity", "level"}


class ProjectNotOpenError(Exception):
    """O projeto da vaga está encerrado: suas vagas não podem mais ser alteradas."""


class VacancyClosedError(Exception):
    """A vaga já está encerrada."""


class QuantityBelowFilledError(Exception):
    """A nova quantidade é menor que o número de candidaturas já aprovadas."""

    def __init__(self, filled: int):
        super().__init__(filled)
        self.filled = filled


def accepts_applications(vacancy: Vacancy, project_status: ProjectStatus, filled: int) -> bool:
    return (
        vacancy.status == VacancyStatus.OPEN
        and project_status == ProjectStatus.OPEN
        and filled < vacancy.quantity
    )


def _filled_counts(session: SessionDep, vacancy_ids: list[int]) -> dict[int, int]:
    """Candidaturas aprovadas por vaga (posições ocupadas)."""
    if not vacancy_ids:
        return {}
    rows = session.exec(
        select(Application.vacancy_id, func.count())
        .where(col(Application.vacancy_id).in_(vacancy_ids), Application.status == ApplicationStatus.APPROVED)
        .group_by(Application.vacancy_id)
    ).all()
    return dict(rows)


def _technologies_by_vacancy(session: SessionDep, vacancy_ids: list[int]) -> dict[int, list[TechnologyRead]]:
    if not vacancy_ids:
        return {}
    rows = session.exec(
        select(VacancyTechnology.vacancy_id, Technology)
        .join(Technology, Technology.id == VacancyTechnology.technology_id)
        .where(col(VacancyTechnology.vacancy_id).in_(vacancy_ids))
        .order_by(Technology.name)
    ).all()
    technologies = defaultdict(list)
    for vacancy_id, technology in rows:
        technologies[vacancy_id].append(TechnologyRead.model_validate(technology))
    return technologies


def project_vacancy_summaries(
    session: SessionDep, projects: list[Project]
) -> dict[int, tuple[int, list[TechnologyRead]]]:
    """
    Por projeto: quantas vagas aceitam candidaturas agora e a stack dessas vagas
    (sem repetição, em ordem alfabética). Poucas consultas para a lista inteira.
    """
    open_projects = {project.id for project in projects if project.status == ProjectStatus.OPEN}
    if not open_projects:
        return {}
    vacancies = session.exec(
        select(Vacancy).where(col(Vacancy.project_id).in_(open_projects), Vacancy.status == VacancyStatus.OPEN)
    ).all()
    vacancy_ids = [vacancy.id for vacancy in vacancies]
    filled = _filled_counts(session, vacancy_ids)
    technologies = _technologies_by_vacancy(session, vacancy_ids)

    counts: dict[int, int] = defaultdict(int)
    stacks: dict[int, dict[int, TechnologyRead]] = defaultdict(dict)
    for vacancy in vacancies:
        if not accepts_applications(vacancy, ProjectStatus.OPEN, filled.get(vacancy.id, 0)):
            continue
        counts[vacancy.project_id] += 1
        for technology in technologies.get(vacancy.id, []):
            stacks[vacancy.project_id][technology.id] = technology
    return {
        project_id: (count, sorted(stacks[project_id].values(), key=lambda technology: technology.name))
        for project_id, count in counts.items()
    }


def to_vacancy_reads(session: SessionDep, project: Project, vacancies: list[Vacancy]) -> list[VacancyRead]:
    vacancy_ids = [vacancy.id for vacancy in vacancies]
    filled = _filled_counts(session, vacancy_ids)
    technologies = _technologies_by_vacancy(session, vacancy_ids)
    reads = []
    for vacancy in vacancies:
        vacancy_filled = filled.get(vacancy.id, 0)
        reads.append(VacancyRead(
            **vacancy.model_dump(include=VACANCY_FIELDS | {"id", "project_id", "status", "created_at", "updated_at"}),
            technologies=technologies.get(vacancy.id, []),
            filled=vacancy_filled,
            available=max(vacancy.quantity - vacancy_filled, 0),
            accepts_applications=accepts_applications(vacancy, project.status, vacancy_filled),
        ))
    return reads


def to_vacancy_read(session: SessionDep, vacancy: Vacancy) -> VacancyRead:
    return to_vacancy_reads(session, vacancy.project, [vacancy])[0]


def get_vacancy(session: SessionDep, vacancy_id: int) -> Vacancy | None:
    return session.get(Vacancy, vacancy_id)


def list_project_vacancies(session: SessionDep, project: Project) -> list[VacancyRead]:
    """Abertas primeiro; dentro de cada grupo, na ordem em que foram criadas."""
    vacancies = session.exec(
        select(Vacancy)
        .where(Vacancy.project_id == project.id)
        .order_by(Vacancy.status != VacancyStatus.OPEN, col(Vacancy.created_at), col(Vacancy.id))
    ).all()
    return to_vacancy_reads(session, project, list(vacancies))


def _replace_technologies(session: SessionDep, vacancy_id: int, technology_ids: list[int]) -> None:
    session.exec(delete(VacancyTechnology).where(VacancyTechnology.vacancy_id == vacancy_id))
    for technology_id in technology_ids:
        session.add(VacancyTechnology(vacancy_id=vacancy_id, technology_id=technology_id))


def create_vacancy(session: SessionDep, project: Project, data: VacancyWrite) -> Vacancy:
    """Cria vaga + stack em um único commit. Valida tudo antes de escrever."""
    if project.status != ProjectStatus.OPEN:
        raise ProjectNotOpenError()
    ensure_technologies_exist(session, set(data.technology_ids))

    vacancy = Vacancy(project_id=project.id, **data.model_dump(include=VACANCY_FIELDS))
    session.add(vacancy)
    session.flush()  # gera vacancy.id
    _replace_technologies(session, vacancy.id, data.technology_ids)
    session.commit()
    session.refresh(vacancy)
    return vacancy


def update_vacancy(session: SessionDep, vacancy: Vacancy, data: VacancyWrite) -> Vacancy:
    """Substitui campos e stack da vaga em um único commit."""
    if vacancy.project.status != ProjectStatus.OPEN:
        raise ProjectNotOpenError()
    if vacancy.status != VacancyStatus.OPEN:
        raise VacancyClosedError()
    filled = _filled_counts(session, [vacancy.id]).get(vacancy.id, 0)
    if data.quantity < filled:
        raise QuantityBelowFilledError(filled)
    ensure_technologies_exist(session, set(data.technology_ids))

    for key, value in data.model_dump(include=VACANCY_FIELDS).items():
        setattr(vacancy, key, value)
    # Explícito: trocar só a stack não altera a linha de vacancy, então o onupdate não dispararia.
    vacancy.updated_at = utcnow()
    session.add(vacancy)
    _replace_technologies(session, vacancy.id, data.technology_ids)
    session.commit()
    session.refresh(vacancy)
    return vacancy


def close_vacancy(session: SessionDep, vacancy: Vacancy) -> Vacancy:
    if vacancy.project.status != ProjectStatus.OPEN:
        raise ProjectNotOpenError()
    if vacancy.status != VacancyStatus.OPEN:
        raise VacancyClosedError()
    vacancy.status = VacancyStatus.CLOSED
    session.add(vacancy)
    session.commit()
    session.refresh(vacancy)
    return vacancy
