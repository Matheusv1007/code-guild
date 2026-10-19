# CodeGuild API (backend)

API REST em **FastAPI** + **SQLModel** + **PostgreSQL**.

Instalação, `.env`, seed e execução estão no [README principal](../README.md#configuração-do-ambiente). Resumo, dentro de `backend/`:

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # depois edite DATABASE_URL e SECRET_KEY
fastapi dev                 # ou: uvicorn main:app --reload
```

Swagger: http://127.0.0.1:8000/docs

## Camadas

| Pasta/arquivo | Responsabilidade |
|---|---|
| `api/` | rotas (endpoints REST); recebem a requisição e chamam os serviços |
| `services/` | regras de negócio e acesso ao banco |
| `models/` | tabelas e schemas SQLModel, uma entidade por arquivo; enums em `models/enums.py` |
| `integration/database.py` | engine, sessão e criação das tabelas (`create_all()` no `lifespan`; não há migrations) |
| `integration/github.py` | cliente da GitHub REST API (`httpx`): perfil público, repositórios e linguagens |
| `auth/` | hash de senha (`bcrypt`), JWT (`python-jose`, 30 min) e a dependência `get_current_user` |
| `main.py` | aplicação FastAPI: CORS e registro das rotas |
| `seed.py` | dados de desenvolvimento |

Variáveis lidas do `.env` (ver `.env.example`): `DATABASE_URL` (obrigatória) e `SECRET_KEY`. Sem `SECRET_KEY`, o código usa um valor inseguro só para desenvolvimento. Opcionais: `GITHUB_API_URL` (padrão `https://api.github.com`) e `GITHUB_TOKEN` (só aumenta o limite de consultas).

## Rotas

| Rotas | Arquivo | Situação |
|---|---|---|
| `/register`, `/login`, `/me` | `api/auth.py` | em uso pelo frontend |
| `/me/profile` (GET/POST/PUT) | `api/profile.py` | em uso pelo frontend (perfil técnico) |
| `/me/github`, `/me/github/refresh` | `api/github.py` | em uso pelo frontend (card GitHub do perfil) |
| `/technologies` | `api/technologies.py` | em uso pelo frontend |
| `/users` | `api/users.py` | CRUD de usuários; cada usuário só altera a própria conta |
| `/leads` | `api/leads.py` | pré-cadastro; ainda sem tela |
| `/items` | `api/item.py` | exemplo de aula, sem uso no produto |

Projetos, vagas e candidaturas já têm modelos e dados no seed, mas **ainda não têm rotas**.

## Modelo de dados

| Tabela | Arquivo | Observação |
|---|---|---|
| `user` | `user.py` | `username` único; senha só em hash |
| `technology` | `technology.py` | catálogo compartilhado (perfil, vagas e futuro match); populado pelo seed |
| `profile` | `profile.py` | 1:1 com `user` (`user_id` único). `full_name`, `bio`, `level`, `interests`, `github_username` opcional; `github_data` (JSON) e `github_updated_at` guardam a última consulta ao GitHub (descartados quando o `github_username` muda) |
| `profile_technology` | `profile.py` | PK (profile, technology, `kind`); `kind` = MASTERED ou LEARNING |
| `project` | `project.py` | `owner_id` → `user` com `ON DELETE RESTRICT`; `status` OPEN/CLOSED; `github_url` opcional |
| `vacancy` | `vacancy.py` | vaga de um projeto; `quantity > 0` (check); `level` opcional; `status` OPEN/CLOSED |
| `vacancy_technology` | `vacancy.py` | stack pedida pela vaga |
| `application` | `application.py` | candidatura; `status` PENDING/APPROVED/REJECTED/CANCELED; índice único parcial `(vacancy_id, user_id) WHERE status = 'PENDING'` (uma candidatura pendente por vaga) |
| `lead` | `lead.py` | pré-cadastro |
| `item` | `item.py` | exemplo de aula |

Datas (`created_at`/`updated_at`) são gravadas em UTC com timezone (`models/common.py`).

Regras previstas para quando as rotas de projetos/vagas/candidaturas existirem (ainda não implementadas): só o dono do projeto cria vagas e decide candidaturas; a vaga precisa estar OPEN e com posições livres; transições de estado só a partir de PENDING; ninguém se candidata à própria vaga.

## Seed

```bash
python seed.py            # popula se o banco estiver vazio; rodar de novo não duplica
```

Cria 33 tecnologias, 12 usuários com perfil, 6 projetos, 12 vagas e 14 candidaturas (dados do protótipo). Não altera `lead` nem `item`. Credencial de exemplo: `pedro` / `123456`, **credencial de desenvolvimento criada pelo seed; não utilizar em produção**.

> ⚠️ `python seed.py --reset` é **destrutivo**: apaga usuários, tecnologias, perfis, projetos, vagas e candidaturas e popula de novo.

## Integração com o GitHub

Fluxo em `services/github_service.py`, com o cliente em `integration/github.py`:

- `GET /me/github` lê só o banco (`profile.github_data` e `github_updated_at`). Funciona mesmo com o GitHub fora do ar.
- `POST /me/github/refresh` consulta o GitHub sob demanda e salva o resultado. Cada atualização faz 2 requisições (`/users/{username}` e `/users/{username}/repos`). As linguagens vêm da linguagem principal de cada repositório próprio (forks não contam), sem uma chamada extra por repositório.
- Intervalo mínimo de 10 minutos entre atualizações do mesmo perfil (`REFRESH_COOLDOWN`); antes disso a rota responde 429 e a resposta traz `next_refresh_at`.
- Erros: username inexistente → 404; perfil sem `github_username` → 422; limite da API do GitHub ou GitHub indisponível → 503. Em qualquer erro, os dados salvos não são alterados.
- Trocar o `github_username` no `PUT /me/profile` descarta os dados salvos da conta anterior (só maiúsculas/minúsculas diferentes não conta como troca).
