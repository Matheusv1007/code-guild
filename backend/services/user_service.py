from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from integration.database import SessionDep
from models import User, UserCreate, UserUpdate
from auth.security import get_password_hash

class AccountConflictError(Exception):
    """Username ou e-mail já em uso por outra conta. `detail` é a mensagem para o usuário."""

    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail

class UsernameTakenError(AccountConflictError):
    def __init__(self):
        super().__init__("Username já registrado")

class EmailTakenError(AccountConflictError):
    def __init__(self):
        super().__init__("E-mail já registrado")

def get_user_by_username(session: SessionDep, username: str) -> User | None:
    """Busca para o login: o nome exato tem prioridade; senão ignora maiúsculas, se só houver uma conta.

    Contas antigas podem ter maiúsculas no username ("Yago.Ic02") e continuam entrando como antes.
    Contas novas são salvas em minúsculas e entram digitando em qualquer caixa.
    """
    user = session.exec(select(User).where(User.username == username)).first()
    if user:
        return user
    matches = session.exec(
        select(User).where(func.lower(User.username) == username.lower()).limit(2)
    ).all()
    return matches[0] if len(matches) == 1 else None

def _check_available(
    session: SessionDep, username: str | None, email: str | None, exclude_id: int | None = None
) -> None:
    """Username e e-mail sem diferenciar maiúsculas; `exclude_id` é a própria conta ao editar."""
    for column, value, error in (
        (User.username, username, UsernameTakenError),
        (User.email, email, EmailTakenError),
    ):
        if value is None:
            continue
        statement = select(User.id).where(func.lower(column) == value.lower())
        if exclude_id is not None:
            statement = statement.where(User.id != exclude_id)
        if session.exec(statement).first() is not None:
            raise error()

def _commit(session: SessionDep, user: User, username: str | None, email: str | None) -> User:
    """Grava; se outra requisição pegou o mesmo username/e-mail no meio, devolve o mesmo conflito."""
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        _check_available(session, username, email, exclude_id=user.id)
        raise
    session.refresh(user)
    return user

def create_user(session: SessionDep, user: UserCreate) -> User:
    _check_available(session, user.username, user.email)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=get_password_hash(user.password),
    )
    session.add(db_user)
    return _commit(session, db_user, user.username, user.email)

def get_user(session: SessionDep, user_id: int) -> User | None:
    return session.get(User, user_id)

def update_user(session: SessionDep, user_id: int, user_update: UserUpdate) -> User | None:
    db_user = session.get(User, user_id)
    if not db_user:
        return None
    user_data = user_update.model_dump(exclude_unset=True)
    _check_available(session, user_data.get("username"), user_data.get("email"), exclude_id=user_id)
    if "password" in user_data:
        db_user.hashed_password = get_password_hash(user_data["password"])
        del user_data["password"]
    for key, value in user_data.items():
        setattr(db_user, key, value)
    session.add(db_user)
    return _commit(session, db_user, user_data.get("username"), user_data.get("email"))

def delete_user(session: SessionDep, user_id: int) -> bool:
    db_user = session.get(User, user_id)
    if not db_user:
        return False
    session.delete(db_user)
    session.commit()
    return True
