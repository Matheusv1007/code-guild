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
| `auth/` | hash de senha (`bcrypt`), JWT (`python-jose`, 30 min) e a dependência `get_current_user` |
| `main.py` | aplicação FastAPI: CORS e registro das rotas |
| `seed.py` | dados de desenvolvimento |

Variáveis lidas do `.env` (ver `.env.example`): `DATABASE_URL` (obrigatória) e `SECRET_KEY`. Sem `SECRET_KEY`, o código usa um valor inseguro só para desenvolvimento.

## Rotas

| Rotas | Arquivo | Situação |
|---|---|---|
| `/register`, `/login`, `/me` | `api/auth.py` | em uso pelo frontend |
| `/me/profile` (GET/POST/PUT) | `api/profile.py` | em uso pelo frontend (perfil técnico) |
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
| `profile` | `profile.py` | 1:1 com `user` (`user_id` único). `full_name`, `bio`, `level`, `interests`, `github_username` opcional; `github_data` (JSON) e `github_updated_at` reservados para a futura integração com o GitHub |
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
