# CodeGuild API

Bem-vindo ao projeto **CodeGuild**. Esta API é construída com **FastAPI**, utilizando **Pydantic** para validação de dados, **SQLModel** para comunicação com o banco de dados e integração com **PostgreSQL**.

O projeto conta com um **CRUD Completo** (Create, Read, Update, Delete) de uma entidade chamada `Item`.

## 🛠 Pré-requisitos
- **Python 3.9+** instalado na sua máquina.
- **PostgreSQL** instalado e rodando.
- (Opcional) Ferramentas como o **Insomnia**, **Postman** ou simplesmente o navegador para testar a API via Swagger (embutido no FastAPI).

---

## 📝 Passo a Passo da Configuração

### Passo 1: Preparar o Banco de Dados (PostgreSQL)
1. Abra o seu servidor do PostgreSQL (por exemplo via DBeaver, pgAdmin ou terminal).
2. Crie um banco de dados novo chamado `codeguild_db`.
3. Verifique qual o usuário e a senha para conectar ao seu servidor local (geralmente usuário é `postgres`).

### Passo 2: Criar e Ativar um Ambiente Virtual (Venv)
No terminal do seu projeto, rode os seguintes comandos para criar o ambiente isolado do projeto:

**No Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**No Mac/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Passo 3: Instalar as Dependências
O projeto possui um arquivo `requirements.txt`. Instale as bibliotecas rodando:
```bash
pip install -r requirements.txt
```

> **O que estamos instalando?**
> - **fastapi**: O framework web.
> - **uvicorn[standard]**: O servidor ASGI para rodar a aplicação.
> - **sqlmodel**: Biblioteca moderna para interagir com o banco de dados usando Pydantic e SQLAlchemy.
> - **psycopg2-binary**: O "driver" que faz o Python conseguir falar com o PostgreSQL.
> - **python-dotenv**: Para ler nossas configurações do arquivo `.env`.

### Passo 4: Configurar as Variáveis de Ambiente (.env)
1. Na raiz da pasta `backend/`, crie um arquivo chamado **exatamente** `.env` (se ele ainda não existir).
2. Abra o arquivo `.env` e adicione as seguintes variáveis de configuração:
   ```env
   # URL de conexão com o banco de dados PostgreSQL
   DATABASE_URL=postgresql://seu_usuario:sua_senha@localhost:5432/codeguild_db
   
   # Chave secreta para assinatura dos tokens JWT (coloque uma string aleatória)
   SECRET_KEY="sua_chave_secreta_aqui"
   ```
3. Troque `seu_usuario` pelo seu usuário do banco (geralmente `postgres`).
4. Troque `sua_senha` pela sua senha do banco.
5. Confirme se a porta (`5432`) e o nome do banco (`codeguild_db`) estão corretos.

### Passo 5: Entendendo a Estrutura de Arquivos
Nós dividimos a aplicação de forma organizada em **Camadas** (Layered Architecture):

- `api/` (Rotas): Onde definimos as rotas (endpoints REST). Eles recebem as requisições e repassam para os serviços.
- `services/` (Regras de Negócio): O "coração" do sistema, contendo a lógica de criação, leitura e alteração no banco.
- `models/` (Validações): Nossos esquemas do **Pydantic** e tabelas do **SQLModel**, isolados em módulos (`item.py`, `user.py`).
- `integration/`: Onde criamos o *"motor"* de conexão com o banco de dados (`database.py`).
- `auth/`: Lógica de autenticação, geração de JWT e dependências de segurança.
- `main.py`: O ponto de entrada da API que une e registra todas as rotas.

### Passo 6: Rodando a Aplicação
Com o ambiente ativado e as dependências instaladas, rode o servidor usando o Uvicorn:

```bash
fastapi dev

ou 

uvicorn main:app --reload
```
- `main`: Nome do arquivo (main.py).
- `app`: Nome da variável dentro do main.py que guarda a instância do FastAPI.
- `--reload`: Faz o servidor reiniciar sozinho sempre que você salvar um arquivo (ótimo para desenvolvimento!).

---

## 🗄️ Modelo de dados (cartão #5)

Além de `user`, `lead` e `item`, o domínio da CodeGuild está em `models/` — uma entidade por arquivo, no mesmo padrão SQLModel (`XBase` + `X(table=True)`). As tabelas são criadas pelo `create_all()` do `lifespan`, como as demais. Diagrama completo em [`docs/diagrama-er.mmd`](../docs/diagrama-er.mmd) (Mermaid, renderiza no GitHub) — **mexeu em um model, atualize o diagrama junto**.

| Tabela | Arquivo | Observação |
|---|---|---|
| `technology` | `technology.py` | Catálogo compartilhado (Python, FastAPI...). Vocabulário comum do match (R4). Populado pelo seed; editar por SQL até existir admin. |
| `profile` | `profile.py` | 1:1 com `user`. `full_name`, `bio`, `level`, `interests`, GitHub opcional (R5): `github_username`, `github_data` (JSONB) e `github_updated_at` fazem o cache com data de renovação. |
| `profile_technology` | `profile.py` | PK (profile, technology, `kind`). `kind` = MASTERED ou LEARNING — as duas listas do perfil numa tabela só, para o match comparar com uma query. |
| `project` | `project.py` | `owner_id` → `user`, `ON DELETE RESTRICT` (não se apaga usuário com projeto). `status` OPEN/CLOSED. `github_url` opcional. |
| `vacancy` | `vacancy.py` | Vaga de um projeto. `quantity > 0` (check). `level` opcional (NULL = qualquer). `status` OPEN/CLOSED. "Lotada" é calculado: candidaturas APPROVED ≥ quantity (R3). |
| `vacancy_technology` | `vacancy.py` | Stack pedida pela vaga, mesmo vocabulário do perfil. |
| `application` | `application.py` | Candidatura. `status` PENDING/APPROVED/REJECTED/CANCELED; os três finais são terminais. **R1** via índice único parcial `(vacancy_id, user_id) WHERE status = 'PENDING'`. `message` opcional. |

Enums em `models/enums.py`; `created_at`/`updated_at` em UTC naive, como `Lead.created_at`.

**Regras que ficam na API, não no banco:** R2 (só o `owner` do projeto cria vagas e decide candidaturas), R3 (vaga OPEN e com posições livres antes de aceitar candidatura), transições de estado só a partir de PENDING, e não se candidatar à própria vaga.

**Interpretação a confirmar com o grupo:** só PENDING conta como candidatura ativa, então cancelar *ou ser rejeitado* libera nova candidatura à mesma vaga. Para bloquear reincidência após rejeição, o índice vira `WHERE status IN ('PENDING','REJECTED')`.

**Fora, por decisão em aberto:** grupos de estudo (SHOULD). O pré-cadastro já é a tabela `lead`.

---

## 🚀 Testando a API (Documentação Automática)

A melhor parte do FastAPI é que ele cria uma documentação interativa para você automaticamente usando o Swagger UI.

1. Acesse pelo navegador: http://127.0.0.1:8000/docs
2. Você verá toda a lista do nosso CRUD.
3. Você pode clicar no botão **"Try it out"** em qualquer rota para fazer requisições sem precisar usar o Postman!

### Roteiro de Testes:
1. **POST `/items/`**: Tente criar um item novo passando Nome e Preço no body.
2. **GET `/items/`**: Liste todos os itens do banco.
3. **GET `/items/{item_id}`**: Coloque o ID do item recém-criado para consultá-lo.
4. **PATCH `/items/{item_id}`**: Atualize o preço ou o nome do item.
5. **DELETE `/items/{item_id}`**: Apague o item do banco e liste novamente para ver se sumiu.

Pronto! Você configurou e testou a API do **CodeGuild** localmente! 🎉
