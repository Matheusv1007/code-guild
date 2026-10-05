from sqlalchemy.exc import IntegrityError
from sqlmodel import delete, select
from integration.database import SessionDep
from models import (Profile, ProfileRead, ProfileTechnology, ProfileWrite, Technology, TechnologyKind,
                    TechnologyRead, User)
from models.common import utcnow


class ProfileAlreadyExistsError(Exception):
    """O usuário já possui perfil (inclui a corrida no UNIQUE de profile.user_id)."""


class InvalidTechnologiesError(Exception):
    """Algum id de tecnologia não existe no catálogo."""

    def __init__(self, ids: list[int]):
        super().__init__(ids)
        self.ids = ids


PROFILE_FIELDS = {"full_name", "level", "bio", "interests", "github_username"}


def get_profile(session: SessionDep, user: User) -> Profile | None:
    return session.exec(select(Profile).where(Profile.user_id == user.id)).first()


def to_profile_read(session: SessionDep, profile: Profile) -> ProfileRead:
    rows = session.exec(
        select(ProfileTechnology.kind, Technology)
        .join(Technology, Technology.id == ProfileTechnology.technology_id)
        .where(ProfileTechnology.profile_id == profile.id)
        .order_by(Technology.name)
    ).all()
    technologies = {kind: [] for kind in TechnologyKind}
    for kind, technology in rows:
        technologies[kind].append(TechnologyRead.model_validate(technology))
    return ProfileRead(
        **profile.model_dump(include=PROFILE_FIELDS | {"id", "created_at", "updated_at"}),
        mastered=technologies[TechnologyKind.MASTERED],
        learning=technologies[TechnologyKind.LEARNING],
    )


def _ensure_technologies_exist(session: SessionDep, data: ProfileWrite) -> None:
    requested = set(data.mastered_technology_ids) | set(data.learning_technology_ids)
    if not requested:
        return
    found = set(session.exec(select(Technology.id).where(Technology.id.in_(requested))).all())
    missing = sorted(requested - found)
    if missing:
        raise InvalidTechnologiesError(missing)


def _add_technology_links(session: SessionDep, profile_id: int, data: ProfileWrite) -> None:
    for technology_id in data.mastered_technology_ids:
        session.add(ProfileTechnology(profile_id=profile_id, technology_id=technology_id, kind=TechnologyKind.MASTERED))
    for technology_id in data.learning_technology_ids:
        session.add(ProfileTechnology(profile_id=profile_id, technology_id=technology_id, kind=TechnologyKind.LEARNING))


def create_profile(session: SessionDep, user: User, data: ProfileWrite) -> Profile:
    """Cria perfil + vínculos em um único commit. Valida tudo antes de escrever."""
    if get_profile(session, user):
        raise ProfileAlreadyExistsError()
    _ensure_technologies_exist(session, data)

    profile = Profile(user_id=user.id, **data.model_dump(include=PROFILE_FIELDS))
    try:
        session.add(profile)
        session.flush()  # gera profile.id; o UNIQUE de user_id falha aqui numa corrida
        _add_technology_links(session, profile.id, data)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise ProfileAlreadyExistsError()
    session.refresh(profile)
    return profile


def update_profile(session: SessionDep, profile: Profile, data: ProfileWrite) -> Profile:
    """Substitui campos e tecnologias do perfil em um único commit."""
    _ensure_technologies_exist(session, data)

    for key, value in data.model_dump(include=PROFILE_FIELDS).items():
        setattr(profile, key, value)
    # Explícito: trocar só as tecnologias não altera a linha de profile, então o onupdate não dispararia.
    profile.updated_at = utcnow()
    session.add(profile)
    session.exec(delete(ProfileTechnology).where(ProfileTechnology.profile_id == profile.id))
    _add_technology_links(session, profile.id, data)
    session.commit()
    session.refresh(profile)
    return profile
