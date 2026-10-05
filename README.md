# CodeGuild

**Fraternidade Acadêmica de Desenvolvedores**

## Visão geral

A CodeGuild é uma plataforma acadêmica para estudantes e desenvolvedores em formação. A ideia é aproximar pessoas por tecnologias e interesses para que elas possam:

- criar um **perfil técnico** (nível, bio, interesses, tecnologias dominadas e estudadas, usuário do GitHub);
- encontrar **projetos** de colegas;
- formar **equipes**;
- futuramente, **candidatar-se a vagas** desses projetos;
- futuramente, **integrar informações públicas do GitHub** ao perfil.

O projeto é desenvolvido na disciplina *Desenvolvimento de Software para Web*. A seção [Estado atual](#estado-atual) diz o que já funciona e o que ainda está planejado.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Backend | Python 3.10+, FastAPI, SQLModel (SQLAlchemy + Pydantic), PostgreSQL (driver `psycopg2`), JWT (`python-jose`) com senha em hash (`bcrypt`), `python-dotenv` |
| Frontend | HTML5, CSS3 e JavaScript puro (sem framework e sem etapa de build) |
| Integração externa | GitHub REST API: **integração planejada/em desenvolvimento** (ainda não há código que a consuma) |

## Estado atual

**Implementado**

- Cadastro, login e logout.
- Sessão com JWT (expira em 30 minutos; ao expirar, o frontend encerra a sessão).
- Proteção das páginas privadas (painel, minhas candidaturas, perfil) e da área autenticada da API.
- Perfil técnico: criar, consultar e editar (`/me/profile`).
- Catálogo de tecnologias (`/technologies`).
- Navegação pública e autenticada: o header muda conforme a sessão; visitantes navegam pelas páginas públicas sem serem levados ao login.
- Landing page com as seções Como funciona, Projetos e Benefícios.
- API FastAPI + PostgreSQL, com seed de dados para desenvolvimento.

**Em desenvolvimento**

- Projetos: os modelos (`project`, `vacancy`, `application`) e o seed já existem, mas ainda não há rotas na API; as telas de explorar, detalhes, painel e minhas candidaturas exibem dados de exemplo fixos no HTML.
- Integração com a GitHub REST API.

**Planejado**

- Vagas e candidaturas reais (hoje "Enviar candidatura" apenas informa que a funcionalidade ainda não está disponível).
- Match por tecnologias (os percentuais exibidos são fixos).
- Busca e filtros funcionais, recuperação de senha, pré-cadastro na landing e layout responsivo para celular.

## Estrutura do projeto

```
code-guild/
├── backend/
│   ├── api/                # rotas (auth, users, profile, technologies, leads, items)
│   ├── auth/               # hash de senha, JWT e dependência de usuário autenticado
│   ├── integration/        # conexão com o banco (database.py)
│   ├── models/             # tabelas e schemas SQLModel
│   ├── services/           # regras de negócio
│   ├── main.py             # aplicação FastAPI (CORS e registro das rotas)
│   ├── requirements.txt
│   ├── seed.py             # dados de desenvolvimento
│   ├── .env.example        # modelo de configuração (versionado)
│   └── .env                # configuração LOCAL (não versionado)
├── paginas/                # uma pasta por tela: index.html + style.css
├── scripts/                # JavaScript compartilhado e de cada tela
├── estilos/global.css      # estilos compartilhados
├── docs/                   # proposta, escopo e protótipo (PDF)
└── README.md
```

## Configuração do ambiente

### 1. PostgreSQL

Com o PostgreSQL instalado e rodando, crie o banco `codeguild_db`:

```bash
psql -U postgres -c "CREATE DATABASE codeguild_db;"
```

A URL de conexão segue o formato:

```
postgresql://postgres:<senha>@localhost:5432/codeguild_db
```

As tabelas são criadas automaticamente quando o backend inicia (não há migrations).

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Windows: copy .env.example .env
```

Em algumas distribuições Linux o comando é `python3` em vez de `python`.

### 3. Arquivo `.env`

Edite `backend/.env` (criado a partir de `backend/.env.example`):

| Variável | Uso |
|---|---|
| `DATABASE_URL` | conexão com o PostgreSQL (obrigatória) |
| `SECRET_KEY` | assinatura dos tokens JWT; use um valor longo e aleatório, por exemplo `python -c "import secrets; print(secrets.token_hex(32))"` |

O `.env` é local de cada integrante e está no `.gitignore`: **nunca faça commit dele**.

As variáveis `GITHUB_API_URL` e `GITHUB_TOKEN` aparecem comentadas no `.env.example` como uso futuro. Nenhum código as lê ainda; elas serão habilitadas quando a task de integração com o GitHub for implementada. O token será opcional e nunca deve ser commitado.

### 4. Executar o backend

Dentro de `backend/`, com o ambiente virtual ativado:

```bash
fastapi dev
# ou
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000
- Swagger (documentação interativa): http://127.0.0.1:8000/docs

### 5. Dados de desenvolvimento (seed)

Com o `.env` configurado, dentro de `backend/`:

```bash
python seed.py
```

Popula o banco se ele estiver vazio (rodar de novo não duplica): 33 tecnologias, 12 usuários com perfil técnico, 6 projetos, 12 vagas e 14 candidaturas, com os mesmos nomes do protótipo. Não altera `lead` nem `item`.

Credencial de exemplo: usuário `pedro`, senha `123456`. **É uma credencial de desenvolvimento criada pelo seed; não utilizar em produção.**

> ⚠️ `python seed.py --reset` é **destrutivo**: apaga todos os usuários, tecnologias, perfis, projetos, vagas e candidaturas antes de popular de novo. Use só se quiser realmente recomeçar o banco local.

### 6. Frontend

Não há build. Na raiz do projeto:

```bash
python -m http.server 5500 --bind 127.0.0.1
```

Abra http://127.0.0.1:5500/paginas/inicio/index.html.

- Use sempre `127.0.0.1` (e não `localhost`): o token de login fica no `localStorage`, que é separado por endereço; trocar entre os dois parece "deslogar".
- O frontend chama a API em `http://127.0.0.1:8000` (constante `API_URL` em `scripts/api.js`); o backend precisa estar rodando.
- O `http.server` não controla cache. Depois de alterar CSS ou JS, recarregue com **Ctrl+Shift+R**.

## Páginas

| Página | Acesso |
|---|---|
| `paginas/inicio` | pública (landing; mostra "Ir para o painel" quando há sessão) |
| `paginas/login`, `paginas/cadastro` | visitante (com sessão, redirecionam ao painel) |
| `paginas/explorar`, `paginas/detalhes-projeto` | públicas (header muda conforme a sessão) |
| `paginas/painel`, `paginas/minhas-candidaturas`, `paginas/perfil` | privadas (sem sessão, redirecionam ao login) |

## Endpoints da API

| Método e rota | Autenticação | Descrição |
|---|---|---|
| `POST /register` | — | cria conta (usuário, e-mail, senha) |
| `POST /login` | — | devolve o token JWT |
| `GET /me` | Bearer | usuário autenticado, com resumo do perfil (ou `null`) |
| `GET /me/profile` · `POST /me/profile` · `PUT /me/profile` | Bearer | consulta, cria e edita o perfil técnico |
| `GET /technologies` | — | catálogo de tecnologias |
| `POST /leads` · `GET /leads` | — · Bearer | pré-cadastro de interessados (sem tela no frontend) |
| `/users` (CRUD) | Bearer, exceto `POST` | gestão de usuários (cada usuário só altera a própria conta) |
| `/items` (CRUD) | Bearer | exemplo de aula, sem uso no produto |

Detalhes dos modelos e das camadas do backend: [`backend/README.md`](backend/README.md).

## Documentação

A pasta `docs/` contém o documento de proposta e escopo (MVP, arquitetura, regras e roadmap), o protótipo das telas e o registro da escolha do nome.

---

**Equipe (Founders):** Matheus Vasco, Pedro Simon, Erick Alves, Guilherme Leal e Guilherme Silva.
*Disciplina: Desenvolvimento de Software para Web*
