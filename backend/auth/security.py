"""
Módulo de Segurança.
Responsável por: Hash das senhas e verificação, e JWT.
"""
import os
from datetime import datetime, timedelta, timezone
import bcrypt
from dotenv import load_dotenv
from jose import jwt

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "fallback-inseguro-para-desenvolvimento")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# O bcrypt só usa os primeiros 72 bytes da senha e recusa entradas maiores. Letra com acento
# ocupa 2 bytes em UTF-8, então o limite vale em bytes, não em caracteres.
MAX_PASSWORD_BYTES = 72

def exceeds_password_limit(password: str) -> bool:
    return len(password.encode("utf-8")) > MAX_PASSWORD_BYTES

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Nenhuma senha acima do limite foi gravada: é só senha incorreta, não erro 500.
    if exceeds_password_limit(plain_password):
        return False
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_password_hash(password: str) -> str:
    if exceeds_password_limit(password):
        raise ValueError(f"A senha deve ter no máximo {MAX_PASSWORD_BYTES} bytes")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
