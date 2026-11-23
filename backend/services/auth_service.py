from sqlmodel import select
from integration.database import SessionDep
from models import Profile, ProfileSummary, User, UserLogin, UserMe
from auth.security import verify_password, create_access_token
from services import launch_service, user_service

class AccessNotReleasedError(Exception):
    """Usuário e senha corretos, mas a conta só entra a partir do lançamento."""

def authenticate_user(session: SessionDep, user_login: UserLogin) -> str | None:
    user = user_service.get_user_by_username(session, user_login.username)
    if not user or not verify_password(user_login.password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    if not launch_service.has_access(user):
        raise AccessNotReleasedError()
    return create_access_token(data={"sub": user.username})

def get_me(session: SessionDep, user: User) -> UserMe:
    profile = session.exec(select(Profile).where(Profile.user_id == user.id)).first()
    return UserMe(
        id=user.id,
        username=user.username,
        email=user.email,
        is_active=user.is_active,
        profile=ProfileSummary.model_validate(profile) if profile else None,
    )
