"""
Seed de dados para desenvolvimento e demonstração (cartão #25).

    python seed.py            # popula se o banco estiver vazio; não duplica se rodar de novo
    python seed.py --reset    # apaga usuários e dados do domínio e popula de novo

Senha de TODOS os usuários do seed: 123456
Não toca em `lead` (pré-cadastro) nem em `item`.

Os dados espelham o protótipo do Figma (projetos, vagas e nomes), para que as telas
possam ser construídas contra o que vai aparecer na apresentação.
"""
import sys

from sqlmodel import Session, delete, select

from auth.security import get_password_hash
from integration.database import create_db_and_tables, engine
from models import (Application, ApplicationStatus, Level, Profile, ProfileTechnology, Project,
                    ProjectStatus, Technology, TechnologyKind, User, Vacancy, VacancyStatus,
                    VacancyTechnology)

SENHA_PADRAO = "123456"

TECHNOLOGIES = [
    "Python", "JavaScript", "TypeScript", "Java", "C#", "Go", "Kotlin", "Swift", "Dart",
    "HTML", "CSS", "Bootstrap", "React", "React Native", "Vue", "Angular", "Flutter",
    "Node.js", "FastAPI", "Django", "Flask", "Spring Boot", ".NET",
    "PostgreSQL", "MySQL", "MongoDB", "SQLite",
    "Docker", "Kubernetes", "AWS", "Git", "GraphQL", "Figma",
]

# username, nome, email, nível, bio, interesses, github, domina, estuda
USERS = [
    ("matheus", "Matheus Vasco", "matheus@unirv.edu.br", Level.ADVANCED,
     "Gosto de arquitetura de software e de organizar o fluxo de trabalho do time.",
     "Back-end, DevOps", "Matheusv1007",
     ["Python", "FastAPI", "PostgreSQL", "Docker", "Git"], ["Kubernetes", "AWS"]),
    ("pedro", "Pedro Simon", "pedro@unirv.edu.br", Level.INTERMEDIATE,
     "Estudante de Engenharia de Software apaixonado por resolver problemas de backend estruturados e construir arquiteturas limpas com Python.",
     "Back-end", None,
     ["Python", "JavaScript", "FastAPI", "PostgreSQL"], ["Docker", "AWS"]),
    ("erick", "Erick Alves", "erick@unirv.edu.br", Level.INTERMEDIATE,
     "Modelagem de dados e banco. Curioso por mobile.",
     "Back-end, Mobile", None,
     ["PostgreSQL", "Python", "SQLite", "Git"], ["React Native", "FastAPI"]),
    ("guilherme.leal", "Guilherme Leal", "guilherme.leal@unirv.edu.br", Level.INTERMEDIATE,
     "Back-end com FastAPI e autenticação. Gosto de API bem documentada.",
     "Back-end", "guilhermeleal-unirv",
     ["Python", "FastAPI", "JavaScript", "PostgreSQL"], ["TypeScript", "Docker"]),
    ("guilherme.silva", "Guilherme Silva", "guilherme.silva@unirv.edu.br", Level.BEGINNER,
     "Começando pelo front. Quero meu primeiro projeto de verdade.",
     "Front-end", None,
     ["HTML", "CSS", "Bootstrap", "JavaScript"], ["React", "Python"]),
    ("ana.lima", "Ana Lima", "ana.lima@unirv.edu.br", Level.ADVANCED,
     "Monitora de Programação Web. Proponho desafios para as turmas.",
     "Back-end, Front-end", None,
     ["Python", "Django", "HTML", "CSS", "Bootstrap", "PostgreSQL"], ["FastAPI"]),
    ("bruno.costa", "Bruno Costa", "bruno.costa@unirv.edu.br", Level.BEGINNER,
     "Primeiro semestre. Aprendendo Python e lógica.",
     "Back-end", None,
     ["Python"], ["FastAPI", "PostgreSQL", "Git"]),
    ("carla.mendes", "Carla Mendes", "carla.mendes@unirv.edu.br", Level.INTERMEDIATE,
     "Front-end com React. Gosto de interface bem cuidada.",
     "Front-end, UX/UI", None,
     ["JavaScript", "TypeScript", "React", "HTML", "CSS"], ["Figma", "Vue"]),
    ("diego.rocha", "Diego Rocha", "diego.rocha@unirv.edu.br", Level.BEGINNER,
     "Quero aprender mobile fazendo.",
     "Mobile", None,
     ["JavaScript", "React Native"], ["Kotlin", "Flutter"]),
    ("fernanda.alves", "Fernanda Alves", "fernanda.alves@unirv.edu.br", Level.INTERMEDIATE,
     "Mobile com Flutter e um pouco de backend.",
     "Mobile, Back-end", None,
     ["Dart", "Flutter", "React Native", "Node.js"], ["FastAPI", "PostgreSQL"]),
    ("joao.pereira", "João Pereira", "joao.pereira@unirv.edu.br", Level.INTERMEDIATE,
     "Design de interfaces e prototipação.",
     "UX/UI, Front-end", None,
     ["Figma", "HTML", "CSS", "JavaScript"], ["React"]),
    ("larissa.santos", "Larissa Santos", "larissa.santos@unirv.edu.br", Level.ADVANCED,
     "Fullstack. Já liderei dois projetos de extensão.",
     "Back-end, Front-end, DevOps", None,
     ["Python", "FastAPI", "PostgreSQL", "React", "TypeScript", "Docker", "AWS"], ["Go", "Kubernetes"]),
]

# título, owner, descrição, github_url, status, tecnologias, vagas
# vaga: (título, quantidade, nível, status, tecnologias)
PROJECTS = [
    ("Sistema de Gestão Acadêmica", "matheus",
     "Plataforma integrada para gestão de disciplinas, notas, frequência e atividades acadêmicas. "
     "O objetivo é simplificar a rotina de estudantes e professores com uma interface moderna e acessível.",
     "https://github.com/Matheusv1007/code-guild", ProjectStatus.OPEN,
     ["Python", "FastAPI", "PostgreSQL", "React", "Docker"],
     [("Backend Developer", 1, Level.INTERMEDIATE, VacancyStatus.OPEN, ["Python", "FastAPI", "PostgreSQL"]),
      ("Frontend Developer", 1, Level.INTERMEDIATE, VacancyStatus.OPEN, ["React", "JavaScript", "TypeScript"])]),
    ("CodeGuild Mobile", "erick",
     "Aplicativo móvel multiplataforma focado no matchmaking de estudantes para formação rápida de squads de projeto.",
     None, ProjectStatus.OPEN,
     ["React Native", "FastAPI", "PostgreSQL"],
     [("Mobile Developer", 2, Level.BEGINNER, VacancyStatus.OPEN, ["React Native", "JavaScript"]),
      ("Backend Developer", 1, Level.INTERMEDIATE, VacancyStatus.OPEN, ["Python", "FastAPI"])]),
    ("Plataforma de Eventos Universitários", "pedro",
     "Portal completo para inscrições, submissão de artigos e controle de presença com emissão de certificados digitais.",
     None, ProjectStatus.OPEN,
     ["React", "JavaScript", "Node.js"],
     [("Frontend Developer", 2, Level.BEGINNER, VacancyStatus.OPEN, ["React", "JavaScript", "HTML", "CSS"]),
      ("UX/UI Designer", 1, None, VacancyStatus.OPEN, ["Figma"]),
      ("Backend Node", 1, Level.INTERMEDIATE, VacancyStatus.OPEN, ["Node.js", "JavaScript", "MongoDB"])]),
    ("Sistema Financeiro para Estudantes", "guilherme.leal",
     "Finanças pessoais descomplicadas com metas de economia integradas a repúblicas estudantis.",
     None, ProjectStatus.OPEN,
     ["Python", "FastAPI", "PostgreSQL"],
     [("Fullstack Developer", 1, Level.ADVANCED, VacancyStatus.OPEN, ["Python", "FastAPI", "PostgreSQL", "React"])]),
    ("Sistema Financeiro Acadêmico", "guilherme.silva",
     "Plataforma web para controle de verbas, bolsas de pesquisa e fluxos de caixa internos dos laboratórios acadêmicos.",
     None, ProjectStatus.OPEN,
     ["Python", "FastAPI", "PostgreSQL", "Bootstrap"],
     [("Backend Developer", 2, Level.INTERMEDIATE, VacancyStatus.OPEN, ["Python", "FastAPI", "PostgreSQL"]),
      ("Frontend Bootstrap", 1, Level.BEGINNER, VacancyStatus.OPEN, ["HTML", "CSS", "Bootstrap", "JavaScript"]),
      ("DevOps", 1, Level.INTERMEDIATE, VacancyStatus.CLOSED, ["Docker", "AWS"])]),
    ("Portal de Monitorias", "ana.lima",
     "Agenda de monitorias e materiais por disciplina. Projeto encerrado no semestre passado.",
     None, ProjectStatus.CLOSED,
     ["Python", "Django", "HTML", "CSS", "Bootstrap"],
     [("Backend Django", 1, Level.BEGINNER, VacancyStatus.CLOSED, ["Python", "Django"])]),
]

# username, projeto, vaga, status, mensagem
APPLICATIONS = [
    ("pedro", "Sistema de Gestão Acadêmica", "Backend Developer", ApplicationStatus.PENDING,
     "Tenho experiência com FastAPI e quero praticar Clean Architecture em um projeto real."),
    ("bruno.costa", "Sistema de Gestão Acadêmica", "Backend Developer", ApplicationStatus.PENDING,
     "Sou iniciante, mas dedico 10h por semana e quero aprender com a equipe."),
    ("larissa.santos", "Sistema de Gestão Acadêmica", "Backend Developer", ApplicationStatus.PENDING, None),
    ("guilherme.leal", "Sistema de Gestão Acadêmica", "Backend Developer", ApplicationStatus.REJECTED,
     "Posso ajudar na autenticação e nas rotas."),
    ("carla.mendes", "Sistema de Gestão Acadêmica", "Frontend Developer", ApplicationStatus.APPROVED,
     "Trabalho com React há um ano e curto o desafio de acessibilidade."),
    ("diego.rocha", "CodeGuild Mobile", "Mobile Developer", ApplicationStatus.PENDING,
     "Quero meu primeiro projeto mobile de verdade."),
    ("fernanda.alves", "CodeGuild Mobile", "Mobile Developer", ApplicationStatus.APPROVED, None),
    ("pedro", "CodeGuild Mobile", "Backend Developer", ApplicationStatus.PENDING, None),
    ("joao.pereira", "Plataforma de Eventos Universitários", "UX/UI Designer", ApplicationStatus.CANCELED,
     "Acabei pegando outro projeto, desculpa."),
    ("guilherme.silva", "Plataforma de Eventos Universitários", "Frontend Developer", ApplicationStatus.PENDING,
     "Quero praticar React em algo real."),
    ("carla.mendes", "Plataforma de Eventos Universitários", "Frontend Developer", ApplicationStatus.APPROVED, None),
    ("larissa.santos", "Sistema Financeiro para Estudantes", "Fullstack Developer", ApplicationStatus.APPROVED, None),
    ("erick", "Sistema Financeiro Acadêmico", "Backend Developer", ApplicationStatus.PENDING,
     "Posso cuidar da modelagem e das queries."),
    ("bruno.costa", "Sistema Financeiro Acadêmico", "Backend Developer", ApplicationStatus.REJECTED, None),
]


def reset(session: Session) -> None:
    """Apaga dados do domínio e usuários (não mexe em lead nem item)."""
    for model in (Application, VacancyTechnology, Vacancy, Project, ProfileTechnology, Profile, User, Technology):
        session.exec(delete(model))
    session.commit()
    print("banco limpo")


def seed(session: Session) -> None:
    if session.exec(select(User).where(User.username == USERS[0][0])).first():
        print("já populado — use `python seed.py --reset` para recriar")
        return

    tech = {}
    for name in TECHNOLOGIES:
        t = session.exec(select(Technology).where(Technology.name == name)).first() or Technology(name=name)
        session.add(t)
        tech[name] = t
    session.flush()

    senha_hash = get_password_hash(SENHA_PADRAO)  # um hash só: bcrypt é lento de propósito
    users = {}
    for username, nome, email, nivel, bio, interesses, github, domina, estuda in USERS:
        u = User(username=username, email=email, hashed_password=senha_hash)
        session.add(u)
        session.flush()
        p = Profile(user_id=u.id, full_name=nome, level=nivel, bio=bio, interests=interesses,
                    github_username=github)
        session.add(p)
        session.flush()
        for n in domina:
            session.add(ProfileTechnology(profile_id=p.id, technology_id=tech[n].id, kind=TechnologyKind.MASTERED))
        for n in estuda:
            session.add(ProfileTechnology(profile_id=p.id, technology_id=tech[n].id, kind=TechnologyKind.LEARNING))
        users[username] = u

    vacancies = {}
    for titulo, owner, descricao, github_url, status, techs, vagas in PROJECTS:
        pr = Project(title=titulo, description=descricao, github_url=github_url, status=status,
                     owner_id=users[owner].id)
        session.add(pr)
        session.flush()
        for vt, qtd, nivel, vstatus, vtechs in vagas:
            v = Vacancy(project_id=pr.id, title=vt, quantity=qtd, level=nivel, status=vstatus)
            v.technologies = [tech[n] for n in vtechs]
            session.add(v)
            session.flush()
            vacancies[(titulo, vt)] = v

    for username, projeto, vaga, status, mensagem in APPLICATIONS:
        session.add(Application(vacancy_id=vacancies[(projeto, vaga)].id, user_id=users[username].id,
                                status=status, message=mensagem))

    session.commit()
    print(f"seed ok: {len(tech)} tecnologias, {len(users)} usuários com perfil, "
          f"{len(PROJECTS)} projetos, {len(vacancies)} vagas, {len(APPLICATIONS)} candidaturas")
    print(f"login de qualquer usuário: username acima (ex.: pedro) / senha {SENHA_PADRAO}")


if __name__ == "__main__":
    create_db_and_tables()
    with Session(engine) as s:
        if "--reset" in sys.argv:
            reset(s)
        seed(s)
