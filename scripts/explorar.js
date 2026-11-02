/**
 * Explorar projetos (paginas/explorar/index.html): mural público dos projetos abertos.
 *
 * Depende de api.js (apiFetch, ApiError) e projects.js (helpers de projeto).
 * GET /projects?status=OPEN é público: funciona com ou sem sessão.
 * Paginação: PAGE_SIZE por vez; "Carregar mais" aparece enquanto a última página vier cheia.
 */

const PAGE_SIZE = 20;

const projectsList = document.getElementById("projects-list");
const projectsLoading = document.getElementById("projects-loading");
const projectsError = document.getElementById("projects-error");
const projectsErrorMessage = document.getElementById("projects-error-message");
const projectsRetry = document.getElementById("projects-retry");
const projectsEmpty = document.getElementById("projects-empty");
const projectsLoadMore = document.getElementById("projects-load-more");

let loadedCount = 0;

function createProjectListCard(project) {
    const card = createElement("article", "card project-list-card");

    const left = createElement("div", "card-left");
    const titleRow = createElement("div", "card-title-row");
    const title = createElement("h3");
    const titleLink = createElement("a", null, project.title);
    titleLink.href = projectDetailsUrl(project.id);
    title.append(titleLink);
    titleRow.append(title);

    left.append(
        titleRow,
        createElement("p", "creator", `Criado por: ${getOwnerName(project.owner)}`),
        createElement("p", "description", project.description),
    );
    if (project.technologies.length > 0) {
        left.append(createTechnologyTags(project.technologies, 8));
    }

    const right = createElement("div", "card-right");
    const link = createElement("a", "btn btn-primary", "Ver projeto");
    link.href = projectDetailsUrl(project.id);
    right.append(createElement("span", "openings", openVacanciesLabel(project.open_vacancies)), link);

    card.append(left, right);
    return card;
}

async function loadProjects() {
    projectsError.hidden = true;
    projectsLoadMore.disabled = true;

    try {
        const projects = await apiFetch(`/projects?status=OPEN&skip=${loadedCount}&limit=${PAGE_SIZE}`);
        projects.forEach((project) => projectsList.append(createProjectListCard(project)));
        loadedCount += projects.length;

        projectsEmpty.hidden = loadedCount > 0;
        projectsLoadMore.hidden = projects.length < PAGE_SIZE;
    } catch (error) {
        projectsErrorMessage.textContent = describeProjectsLoadError(error);
        projectsError.hidden = false;
    } finally {
        projectsLoading.hidden = true;
        projectsLoadMore.disabled = false;
    }
}

projectsRetry.addEventListener("click", loadProjects);
projectsLoadMore.addEventListener("click", loadProjects);
loadProjects();
