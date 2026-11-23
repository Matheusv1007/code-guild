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

Variáveis lidas do `.env` (ver `.env.example`): `DATABASE_URL` (obrigatória) e `SECRET_KEY`. Sem `SECRET_KEY`, o código usa um valor inseguro só para desenvolvimento. Opcionais: `GITHUB_API_URL` (padrão `https://api.github.com`), `GITHUB_TOKEN` (só aumenta o limite de consultas), `LAUNCH_AT` e `EARLY_ACCESS_USER_IDS` (trava de lançamento, abaixo).

## Trava de lançamento

Regras em `services/launch_service.py`, aplicadas em `api/auth.py`, `api/users.py` e `auth/dependencies.py`.

- `LAUNCH_AT` (data com fuso, ex.: `2026-12-01T19:00:00-03:00`): antes dela o cadastro fica fechado e só entra quem está em `EARLY_ACCESS_USER_IDS` (ids separados por vírgula, a equipe).
- Antes do lançamento: `POST /register` e `POST /users` → 403; `POST /login` de conta fora da lista → 403 com a data de liberação; token já emitido de conta fora da lista → 401 em qualquer rota autenticada.
- A partir de `LAUNCH_AT` tudo libera sozinho, sem deploy. Sem `LAUNCH_AT` não há trava (padrão no ambiente local).
- `GET /launch` (público) devolve `{"launch_at": ..., "open": ...}`; o front usa para a contagem regressiva, os botões de cadastro e a página de cadastro.
- A lista usa id, não username: hoje o username pode ser trocado em `PUT /users/{id}`.

## Rotas

| Rotas | Arquivo | Situação |
|---|---|---|
| `/register`, `/login`, `/me`, `/launch` | `api/auth.py` | em uso pelo frontend |
| `/me/profile` (GET/POST/PUT) | `api/profile.py` | em uso pelo frontend (perfil técnico) |
| `/me/github`, `/me/github/refresh` | `api/github.py` | em uso pelo frontend (card GitHub do perfil) |
| `/technologies` | `api/technologies.py` | em uso pelo frontend |
| `/projects`, `/projects/{id}`, `/projects/{id}/close`, `/me/projects` | `api/projects.py` | em uso pelo frontend (explorar, detalhes, painel, projeto-form) |
| `/projects/{id}/vacancies`, `/vacancies/{id}`, `/vacancies/{id}/close` | `api/vacancies.py` | em uso pelo frontend (vagas nos detalhes do projeto) |
| `/vacancies/{id}/applications`, `/me/applications`, `/projects/{id}/applications`, `/projects/{id}/members`, `/applications/{id}/approve`, `/reject`, `/cancel` | `api/applications.py` | em uso pelo frontend (detalhes do projeto e minhas candidaturas) |
| `/users` | `api/users.py` | `POST` cria conta (igual a `/register`); `GET`/`PUT`/`DELETE /users/{id}` só da própria conta. Não há listagem de usuários |
| `/leads` (POST) | `api/leads.py` | pré-cadastro, em uso pela landing; sem rota de listagem |
| `/items` | `api/item.py` | exemplo de aula, sem uso no produto |

### Contas: cadastro e login

Regras em `models/user.py` (`UserCreate`, `UserUpdate`) e `services/user_service.py`; limite de senha em `auth/security.py`. Valem para `POST /register`, `POST /users` e `PUT /users/{id}` (só nos campos enviados).

- **Senha:** mínimo de 8 caracteres e máximo de 72 **bytes** (limite do bcrypt; "ç" ocupa 2). Fora disso → 422 com a mensagem.
- **Username:** sem espaços nas pontas, salvo em minúsculas e no formato `[a-z0-9._-]{3,30}`. Repetido, sem diferenciar maiúsculas ("Pedro" com "pedro" existente) → 400.
- **E-mail:** obrigatório, com formato válido (até 254 caracteres), salvo em minúsculas e único sem diferenciar maiúsculas → 400 `E-mail já registrado`.
- **Login:** sem regras de formato, para contas antigas fora do padrão (ex.: `Yago.Ic02`) continuarem entrando. Senha acima de 72 bytes → 401 `Usuário ou senha incorretos` (nunca 500). O nome exato tem prioridade; se não houver, vale a conta que bate ignorando maiúsculas (desde que seja só uma).
- **Índice único de e-mail:** `uq_user_email_lower` (`lower(email)`) é criado na inicialização, também em banco que já existia (`create_all()` não faz isso sozinho). Se já houver e-mails repetidos, o índice não é criado e o log mostra `AVISO` com a consulta para achá-los; a checagem do serviço continua valendo. Resolva os repetidos e reinicie a API.
- A senha do seed (`123456`) tem menos de 8 caracteres: só vale para essas contas de desenvolvimento, criadas direto no banco.

### Projetos

Regras em `services/project_service.py`; a autorização fica em `api/projects.py` (`ensure_project_owner`, compara `project.owner_id` com o usuário autenticado).

- Leitura pública (`GET /projects`, `GET /projects/{id}`); criar, editar e encerrar exigem login.
- Só o responsável edita (`PUT`) ou encerra (`POST /close`): outro usuário recebe 403.
- Projeto encerrado não aceita edição nem novo encerramento (409) e não é reaberto. Encerrar fecha no mesmo commit as vagas OPEN do projeto.
- `title` (1–120) e `description` (1–5000) chegam sem espaços nas pontas; `github_url` vazio vira `null` e, se informado, precisa ser `https://github.com/usuario` ou `https://github.com/usuario/repositorio`.
- Respostas trazem `owner` (`id`, `username` e `full_name` do perfil, ou `null` sem perfil), `open_vacancies` (vagas que aceitam candidaturas agora) e `technologies` (stack dessas vagas, sem repetição).

### Vagas

Regras em `services/vacancy_service.py`; a autorização reaproveita `ensure_project_owner` (`api/vacancies.py`).

- Leitura pública (`GET /projects/{id}/vacancies`); criar, editar e encerrar exigem ser o responsável pelo projeto (403).
- Projeto encerrado: nenhuma vaga é criada, editada ou encerrada (409). Vaga encerrada não é editada nem reaberta (409).
- `title` 1–120 (especialidade), `quantity` 1–50, `level` opcional (`null` = qualquer nível), `description` até 2000, `technology_ids` do catálogo (ids inexistentes → 422). `PUT` substitui tudo, inclusive a stack.
- Disponibilidade calculada a cada leitura: `filled` = candidaturas APPROVED, `available` = `quantity - filled`. A quantidade não pode ficar abaixo de `filled` (409).
- `accepts_applications` (função `vacancy_service.accepts_applications`): vaga OPEN, projeto OPEN e `filled < quantity`. Regra do escopo: vaga encerrada ou sem disponibilidade não aceita novas candidaturas; o fluxo de candidaturas valida com a mesma função.

### Candidaturas

Regras em `services/application_service.py`; a autorização fica em `api/applications.py` (aprovar e rejeitar usam `ensure_project_owner`; cancelar, só o próprio candidato).

- `POST /vacancies/{id}/applications` (mensagem opcional, até 1000): exige perfil técnico criado (409), não vale para vaga do próprio projeto (403) e a vaga precisa aceitar candidaturas (409).
- Uma candidatura ativa (PENDING ou APPROVED) por pessoa em cada vaga (409). Depois de rejeitada ou cancelada, a pessoa pode se candidatar de novo.
- Transições só a partir de PENDING: APPROVED ou REJECTED (responsável), CANCELED (candidato). Qualquer outra → 409.
- Aprovar trava a vaga (`SELECT ... FOR UPDATE`) e confere posição livre: duas aprovações ao mesmo tempo não passam da quantidade (a segunda recebe 409).
- Vaga ou projeto encerrado: as PENDING continuam como estão, mas não podem mais ser aprovadas (409); rejeitar e cancelar continuam permitidos.
- `GET /projects/{id}/applications` (só o responsável) traz todas as candidaturas das vagas do projeto com o resumo do perfil do candidato (nome, nível, GitHub e tecnologias), pendentes primeiro.
- `GET /me/applications`: candidaturas do usuário autenticado, mais recentes primeiro.
- `GET /projects/{id}/members` (público): equipe do projeto, ou seja, as candidaturas aprovadas (nome, username, nível e vaga ocupada), sem e-mail. O responsável não entra na lista; ele já vem em `owner` no projeto.

## Modelo de dados

| Tabela | Arquivo | Observação |
|---|---|---|
| `user` | `user.py` | `username` único (sem diferenciar maiúsculas no cadastro); e-mail único por índice em `lower(email)`; senha só em hash |
| `technology` | `technology.py` | catálogo compartilhado (perfil, vagas e futuro match); populado pelo seed |
| `profile` | `profile.py` | 1:1 com `user` (`user_id` único). `full_name`, `bio`, `level`, `interests`, `github_username` opcional; `github_data` (JSON) e `github_updated_at` guardam a última consulta ao GitHub (descartados quando o `github_username` muda) |
| `profile_technology` | `profile.py` | PK (profile, technology, `kind`); `kind` = MASTERED ou LEARNING |
| `project` | `project.py` | `owner_id` → `user` com `ON DELETE RESTRICT`; `status` OPEN/CLOSED; `github_url` opcional |
| `vacancy` | `vacancy.py` | vaga de um projeto; `quantity > 0` (check); `level` opcional; `status` OPEN/CLOSED |
| `vacancy_technology` | `vacancy.py` | stack pedida pela vaga |
| `application` | `application.py` | candidatura; `status` PENDING/APPROVED/REJECTED/CANCELED; índice único parcial `(vacancy_id, user_id) WHERE status = 'PENDING'`. A regra completa (PENDING ou APPROVED) é checada no serviço, porque mudar o índice não altera bancos que já existem (não há migrations) |
| `lead` | `lead.py` | pré-cadastro |
| `item` | `item.py` | exemplo de aula |

Datas (`created_at`/`updated_at`) são gravadas em UTC com timezone (`models/common.py`).

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
