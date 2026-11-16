from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlmodel import select

from integration.database import SessionDep
from models import User, TokenData
from auth.security import SECRET_KEY, ALGORITHM
from services import launch_service

security_bearer = HTTPBearer()

def get_current_user(
    session: SessionDep,
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),  # noqa: B008
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    user = session.exec(select(User).where(User.username == token_data.username)).first()
    # Usuário removido ou desativado depois da emissão do token não é mais aceito.
    if user is None or not user.is_active:
        raise credentials_exception
    # Antes do lançamento só a equipe usa a plataforma; tokens já emitidos param de valer na hora.
    if not launch_service.has_access(user):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=launch_service.access_not_released_message(),
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

def require_registration_open() -> None:
    """Antes do lançamento ninguém cria conta: visitantes usam o pré-cadastro."""
    if not launch_service.is_launched():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=launch_service.registration_closed_message(),
        )
