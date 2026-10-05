"""
Arquivo principal (entry point) da aplicação FastAPI.
Aqui nós configuramos a instância principal do app, middlewares (como CORS) 
e incluímos as rotas (routers) definidas em outros arquivos.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.item import app_router
from api.auth import auth_router
from api.users import users_router
from api.leads import leads_router
from api.technologies import technologies_router
from integration.database import lifespan

# Criação da instância principal da aplicação FastAPI
# O parâmetro 'lifespan' permite executar código antes da API começar a receber requisições (ex: criar tabelas).
app = FastAPI(
    title="CodeGuild API",
    description="Backend da aplicação CodeGuild.",
    version="1.0.0",
    lifespan=lifespan
)

# ==========================================
# Configuração do Middleware de CORS (Cross-Origin Resource Sharing)
# ==========================================
# O CORS é um mecanismo de segurança dos navegadores que impede que um site de uma origem 
# (ex: http://meu-frontend.com) acesse recursos de outra origem (ex: http://minha-api.com).
# Para permitir que o frontend (ex: React rodando na porta 3000) consuma esta API (rodando na porta 8000),
# precisamos configurar explicitamente essas políticas.
#
# AVISO PARA PRODUÇÃO: O uso de `allow_origins=["*"]` permite que QUALQUER site faça requisições
# para a sua API. Em um ambiente real, você deve listar apenas os domínios confiáveis.
# Exemplo seguro: allow_origins=["http://localhost:3000", "https://meu-site-oficial.com"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em ambiente de aula deixamos aberto ("*"), mas com o alerta acima!
    allow_credentials=True, # Permite envio de cookies e cabeçalhos de autenticação (como o Bearer JWT)
    allow_methods=["*"],  # Permite todos os métodos HTTP (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],  # Permite todos os cabeçalhos (essencial para receber o "Authorization: Bearer <token>")
)

# Registramos as rotas de autenticação (login e registro)
app.include_router(auth_router)

# Inclui as rotas (endpoints) de CRUD de itens
app.include_router(app_router)

# Inclui as rotas (endpoints) de CRUD de usuários
app.include_router(users_router)

# Inclui as rotas para captura de Leads (Interessados)
app.include_router(leads_router)

# Inclui o catálogo público de tecnologias
app.include_router(technologies_router)
