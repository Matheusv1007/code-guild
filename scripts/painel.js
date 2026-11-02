/**
 * Painel: saudação com o primeiro nome do usuário autenticado e, se ele ainda
 * não tem perfil técnico (GET /me com profile: null), aviso para completá-lo.
 * Depende de session.js (hasSession, getCurrentUser, getFirstName), api.js e projects.js.
 *
 * - "Meus projetos": GET /me/projects (abertos e encerrados) e o total em "Projetos criados";
 * - "Projetos abertos recentes": GET /projects?status=OPEN, sem os projetos do próprio usuário.
 * As demais estatísticas (candidaturas) continuam estáticas nesta etapa.
 */

const RECENT_PROJECTS_SHOWN = 3;

/** Card de projeto do grid do painel; `own` mostra status e o atalho de edição. */
function createProjectGridCard(project, own) {
    const card = createElement("article", "card project-card");

    const header = createElement("div", "card-header");
    header.append(createElement("h3", null, project.title));
    if (own) {
        header.append(createStatusBadge(project.status));
    }

    const footer = createElement("div", "project-footer");
    if (project.status === "OPEN") {
        footer.append(createElement("span", "openings", openVacanciesLabel(project.open_vacancies)));
    }
    const actions = createElement("div", "project-card-actions");
    if (own && project.status === "OPEN") {
        const edit = createElement("a", "btn btn-outline", "Editar");
        edit.href = projectFormUrl(project.id);
        actions.append(edit);
    }
    const view = createElement("a", "btn btn-outline", "Ver projeto \u2192");
    view.href = projectDetailsUrl(project.id);
    actions.append(view);
    footer.append(actions);

    card.append(header);
    if (!own) {
        card.append(createElement("p", "project-card-owner", `Por ${getOwnerName(project.owner)}`));
    }
    card.append(createElement("p", "project-card-description", project.description));
    if (project.technologies.length > 0) {
        card.append(createTechnologyTags(project.technologies, 4));
    }
    card.append(footer);
    return card;
}

/** Preenche um grid (ou o estado vazio/erro) a partir de uma lista já carregada. */
function renderProjectSection({ grid, status, empty }, projects, own) {
    status.hidden = true;
    grid.replaceChildren(...projects.map((project) => createProjectGridCard(project, own)));
    empty.hidden = projects.length > 0;
}

function showProjectSectionError({ status }, error) {
    status.textContent = describeProjectsLoadError(error);
    status.classList.add("section-status-error");
}

const myProjectsSection = {
    grid: document.getElementById("my-projects"),
    status: document.getElementById("my-projects-status"),
    empty: document.getElementById("my-projects-empty"),
};
const recentProjectsSection = {
    grid: document.getElementById("recent-projects"),
    status: document.getElementById("recent-projects-status"),
    empty: document.getElementById("recent-projects-empty"),
};

async function loadMyProjects() {
    try {
        const projects = await apiFetch("/me/projects", { auth: true });
        renderProjectSection(myProjectsSection, projects, true);
        document.getElementById("stat-created-projects").textContent = String(projects.length);
    } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
            showProjectSectionError(myProjectsSection, error);
        }
    }
}

async function loadRecentProjects(user) {
    try {
        // Pede alguns a mais: os do próprio usuário saem da lista.
        const projects = await apiFetch(`/projects?status=OPEN&limit=${RECENT_PROJECTS_SHOWN * 3}`);
        const others = projects.filter((project) => project.owner.id !== user.id).slice(0, RECENT_PROJECTS_SHOWN);
        renderProjectSection(recentProjectsSection, others, false);
    } catch (error) {
        showProjectSectionError(recentProjectsSection, error);
    }
}

if (hasSession) {
    loadMyProjects();

    getCurrentUser()
        .then((user) => {
            document.getElementById("welcome-title").textContent = `Olá, ${getFirstName(user)} 👋`;
            document.getElementById("profile-reminder").hidden = user.profile !== null;
            loadRecentProjects(user);
        })
        .catch((error) => {
            // Erro já registrado por session.js; a saudação genérica permanece.
            showProjectSectionError(recentProjectsSection, error);
        });
}
