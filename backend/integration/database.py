"""
Módulo de configuração do banco de dados utilizando SQLModel e SQLAlchemy.
Lida com a conexão, criação das tabelas e injeção de dependência da sessão.
"""
import os
from contextlib import asynccontextmanager
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, create_engine

# Importamos os modelos para que as tabelas sejam criadas corretamente
import models

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, echo=True)

def ensure_user_email_index():
    """Garante o índice único de e-mail (sem diferenciar maiúsculas) em banco que já existia.

    O create_all() só cria índices de tabelas novas. Se já houver e-mail repetido o índice não
    pode ser criado: o aviso aparece no log e a API segue funcionando (o cadastro continua
    checando duplicidade pelo serviço), até os repetidos serem resolvidos.
    """
    index = next(i for i in models.User.__table__.indexes if i.name == models.user.EMAIL_UNIQUE_INDEX)
    try:
        index.create(engine, checkfirst=True)
    except IntegrityError:
        print(
            f"AVISO: índice {index.name} não criado, há e-mails repetidos na tabela user. "
            'Consulte: SELECT lower(email), count(*) FROM "user" GROUP BY 1 HAVING count(*) > 1;'
        )

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    ensure_user_email_index()

def get_session():
    with Session(engine) as session:
        yield session

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Criando tabelas no banco de dados...")
    create_db_and_tables()
    yield

SessionDep = Annotated[Session, Depends(get_session)]
