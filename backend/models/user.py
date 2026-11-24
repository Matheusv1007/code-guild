import re

from pydantic import field_validator
from sqlalchemy import Index, text
from sqlmodel import Field, SQLModel

from auth.security import MAX_PASSWORD_BYTES, exceeds_password_limit

from .profile import ProfileSummary

# Regras de conta nova (cadastro e troca de dados). Contas antigas fora delas continuam válidas:
# UserBase/UserRead, usados na leitura e no login, não aplicam estas regras.
USERNAME_PATTERN = re.compile(r"[a-z0-9._-]{3,30}")
EMAIL_PATTERN = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")  # mesma regra do cadastro.js
EMAIL_MAX_LENGTH = 254
PASSWORD_MIN_LENGTH = 8

EMAIL_UNIQUE_INDEX = "uq_user_email_lower"


def normalize_username(value: str | None) -> str:
    """Sem espaços nas pontas, em minúsculas; só letras, números, ponto, hífen e sublinhado."""
    if value is None:
        raise ValueError("Informe o usuário")
    value = value.strip().lower()
    if not USERNAME_PATTERN.fullmatch(value):
        raise ValueError(
            "O usuário deve ter de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado, sem espaços"
        )
    return value


def normalize_email(value: str | None) -> str:
    """Sem espaços nas pontas, em minúsculas e com formato de e-mail."""
    if value is None:
        raise ValueError("Informe o e-mail")
    value = value.strip().lower()
    if len(value) > EMAIL_MAX_LENGTH or not EMAIL_PATTERN.fullmatch(value):
        raise ValueError("Informe um e-mail válido")
    return value


def check_password(value: str | None) -> str:
    """Mínimo de caracteres e máximo em bytes (limite do bcrypt)."""
    if value is None:
        raise ValueError("Informe a senha")
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"A senha deve ter pelo menos {PASSWORD_MIN_LENGTH} caracteres")
    if exceeds_password_limit(value):
        raise ValueError(f"A senha deve ter no máximo {MAX_PASSWORD_BYTES} bytes (letras com acento contam 2)")
    return value


class UserBase(SQLModel):
    """Classe base para Usuários. Contém os dados em comum."""
    username: str = Field(index=True, unique=True)
    email: str | None = Field(default=None)
    is_active: bool = Field(default=True)

class User(UserBase, table=True):
    """Modelo que representa a tabela 'user' no banco de dados."""
    # Índice único sem diferenciar maiúsculas. Em banco já existente o create_all() não o cria:
    # integration/database.py cuida disso na inicialização.
    __table_args__ = (Index(EMAIL_UNIQUE_INDEX, text("lower(email)"), unique=True),)

    id: int | None = Field(default=None, primary_key=True)
    hashed_password: str

class UserCreate(SQLModel):
    """Schema utilizado para criar um usuário (POST /register e POST /users)."""
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, value):
        return normalize_username(value)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        return normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        return check_password(value)

class UserUpdate(SQLModel):
    """Schema utilizado para atualizar um usuário (PUT/PATCH). Campo enviado segue as regras do cadastro."""
    username: str | None = None
    email: str | None = None
    password: str | None = None
    is_active: bool | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, value):
        return normalize_username(value)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        return normalize_email(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        return check_password(value)

class UserLogin(SQLModel):
    """Schema simplificado para receber apenas username e password no login (via JSON).

    Sem regras de formato: contas antigas fora do padrão atual precisam continuar entrando, e senha
    acima do limite do bcrypt é tratada como senha incorreta (401) em auth.security.verify_password.
    """
    username: str
    password: str

class UserRead(UserBase):
    id: int

class UserMe(UserRead):
    """Schema de resposta de GET /me: usuário autenticado + perfil básico (ou null)."""
    profile: ProfileSummary | None = None
