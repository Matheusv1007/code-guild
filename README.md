# CodeGuild 🚀

**Fraternidade Acadêmica de Desenvolvedores**

A **CodeGuild** é uma comunidade acadêmica voltada a estudantes e desenvolvedores em formação que desejam transformar o aprendizado teórico em experiência prática. A plataforma aproxima pessoas por tecnologias, interesses e objetivos, permitindo formar equipes para projetos, encontrar vagas compatíveis e construir um portfólio colaborativo.

---

## 🎯 Proposta de Valor e Público-Alvo

A CodeGuild resolve o "momento zero" da colaboração: descobrir pessoas e oportunidades adequadas antes de migrar o trabalho para ferramentas como GitHub, Discord ou Trello. 

**Público-alvo:**
- **Iniciantes:** Buscam o primeiro projeto prático e parceiros no mesmo nível.
- **Intermediários/Veteranos:** Desejam liderar equipes, praticar novas tecnologias e fortalecer o portfólio.
- **Monitores/Professores:** Desejam propor desafios, divulgar iniciativas ou orientar projetos.

---

## 🏗️ Arquitetura do Projeto

O projeto adota uma arquitetura Cliente-Servidor (API REST + Banco Relacional), focada na separação de responsabilidades.

- **Front-end:** HTML5, CSS3, Bootstrap 5 e JavaScript (Landing page, consumo de API, interface responsiva).
- **Back-end:** Python + FastAPI (Regras de negócio, autenticação, endpoints REST).
- **Persistência:** PostgreSQL + SQLAlchemy/SQLModel (Usuários, perfis, projetos, vagas).
- **Autenticação:** JWT (JSON Web Token) com hash seguro de senha.
- **Integração Externa:** GitHub REST API (Importar dados públicos para enriquecer o perfil técnico).

---

## 📂 Documentação e Protótipos

Na pasta `docs/` do repositório, você encontrará arquivos fundamentais do planejamento:
- **Documento de Proposta e Escopo:** Definição completa do MVP, visão arquitetural, requisitos não funcionais e roadmap.
- **Protótipos e Design:** Documentos em PDF contendo as telas propostas e o design visual do MVP.
- **Brainstorming:** Registros sobre a escolha do nome e identidade.

---

## ⚙️ Backend (API FastAPI)

Todo o código da API está localizado na pasta `backend/`. O projeto conta com rotas estruturadas (auth, users, items, leads), integração com o PostgreSQL e validações usando Pydantic e SQLModel.

### Pré-requisitos
- **Python 3.9+** instalado na sua máquina.
- **PostgreSQL** instalado e rodando.

### Passo a Passo Rápido

#### 1. Preparar o Banco de Dados
Crie um banco de dados novo no PostgreSQL chamado `codeguild_db` (ou outro nome de sua preferência).

#### 2. Ambiente Virtual
Abra o terminal na pasta `backend/` e crie o ambiente isolado:
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

#### 3. Instalar as Dependências
```bash
pip install -r requirements.txt
```

#### 4. Configurar as Variáveis de Ambiente (.env)
1. Na pasta `backend/`, crie um arquivo chamado **exatamente** `.env` (caso ainda não exista).
2. Preencha este arquivo com as suas configurações locais de banco e segurança:
```env
# URL de conexão com o banco de dados PostgreSQL
DATABASE_URL=postgresql://seu_usuario:sua_senha@localhost:5432/codeguild_db

# Chave secreta para JWT (pode ser qualquer string longa e aleatória)
SECRET_KEY="sua_chave_secreta_aqui"
```
*Lembre-se de substituir `seu_usuario` e `sua_senha` pelas credenciais do seu PostgreSQL local e verificar se o banco `codeguild_db` foi criado.*

#### 5. Rodar a Aplicação
Dentro da pasta `backend/`, inicie o servidor:
```bash
fastapi dev
# ou
uvicorn main:app --reload
```

A documentação interativa (Swagger UI) ficará disponível em: **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**. Você pode testar todas as rotas (CRUD de itens, criação de usuários, login, etc) diretamente por lá!

---

**Equipe (Founders):** Matheus Vasco, Pedro Simon, Erick Alves, Guilherme Leal e Guilherme Silva.  
*Disciplina: Desenvolvimento de Software para Web*
