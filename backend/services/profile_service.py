from sqlalchemy.exc import IntegrityError
from sqlmodel import col, delete, select
from integration.database import SessionDep
from models import (Profile, ProfileRead, ProfileTechnology, ProfileWrite, PublicProfileRead, Technology,
                    TechnologyKind, TechnologyRead, User)
from models.common import utcnow
from services.github_service import clear_github_data, to_github_read
from services.technology_service import ensure_technologies_exist


class ProfileAlreadyExistsError(Exception):
    """O usuário já possui perfil (inclui a corrida no UNIQUE de profile.user_id)."""


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


def get_public_profile(session: SessionDep, user_id: int) -> PublicProfileRead | None:
    """Perfil de uma conta ativa, sem dados privados. None se a conta não existe, está inativa ou não tem perfil."""
    row = session.exec(
        select(Profile, User).join(User, User.id == Profile.user_id).where(User.id == user_id, col(User.is_active).is_(True))
    ).first()
    if row is None:
        return None
    profile, user = row
    read = to_profile_read(session, profile)
    return PublicProfileRead(
        user_id=user.id,
        username=user.username,
        full_name=read.full_name,
        level=read.level,
        bio=read.bio,
        interests=read.interests,
        mastered=read.mastered,
        learning=read.learning,
        github=to_github_read(profile).model_copy(update={"next_refresh_at": None}),
    )


def _ensure_technologies_exist(session: SessionDep, data: ProfileWrite) -> None:
    ensure_technologies_exist(session, set(data.mastered_technology_ids) | set(data.learning_technology_ids))


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

    # Outro usuário do GitHub (ou nenhum): os dados salvos eram de outra conta.
    # O GitHub não diferencia maiúsculas de minúsculas no username.
    if (profile.github_username or "").lower() != (data.github_username or "").lower():
        clear_github_data(profile)

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
