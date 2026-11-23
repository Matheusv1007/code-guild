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
const projectsNoMatch = document.getElementById("projects-no-match");
const searchInput = document.getElementById("search-input");

let loadedCount = 0;
let loading = false;

function createProjectListCard(project) {
    const card = createElement("article", "card project-list-card");
    card.dataset.search = buildSearchText(project);

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

/** Texto em minúsculas usado pela busca: título, descrição, responsável e tecnologias. */
function buildSearchText(project) {
    return [
        project.title,
        project.description,
        getOwnerName(project.owner),
        ...project.technologies.map((technology) => technology.name),
    ]
        .join(" ")
        .toLowerCase();
}

/**
 * Filtra no navegador: a API ainda não aceita busca por termo. Enquanto houver termo e mais
 * páginas, continua carregando para a busca valer para todos os projetos abertos.
 */
function applyFilter() {
    const term = searchInput.value.trim().toLowerCase();
    let visible = 0;
    for (const card of projectsList.children) {
        card.hidden = term !== "" && !card.dataset.search.includes(term);
        if (!card.hidden) {
            visible += 1;
        }
    }

    const hasMore = !projectsLoadMore.hidden;
    projectsNoMatch.hidden = !(term !== "" && loadedCount > 0 && visible === 0 && !hasMore && !loading);
    if (term !== "" && hasMore && !loading) {
        loadProjects();
    }
}

async function loadProjects() {
    if (loading) {
        return;
    }
    loading = true;
    projectsError.hidden = true;
    projectsLoadMore.disabled = true;
    let loaded = false;

    try {
        const projects = await apiFetch(`/projects?status=OPEN&skip=${loadedCount}&limit=${PAGE_SIZE}`);
        projects.forEach((project) => projectsList.append(createProjectListCard(project)));
        loadedCount += projects.length;

        projectsEmpty.hidden = loadedCount > 0;
        projectsLoadMore.hidden = projects.length < PAGE_SIZE;
        loaded = true;
    } catch (error) {
        projectsErrorMessage.textContent = describeProjectsLoadError(error);
        projectsError.hidden = false;
    } finally {
        loading = false;
        projectsLoading.hidden = true;
        projectsLoadMore.disabled = false;
    }

    // Fora do try/finally: pode disparar a próxima página (busca com termo), sem sobrepor esta.
    if (loaded) {
        applyFilter();
    }
}

projectsRetry.addEventListener("click", loadProjects);
projectsLoadMore.addEventListener("click", loadProjects);
searchInput.addEventListener("input", applyFilter);

// Termo vindo da busca do painel (?q=)
searchInput.value = (new URLSearchParams(window.location.search).get("q") || "").trim().slice(0, 100);
loadProjects();
