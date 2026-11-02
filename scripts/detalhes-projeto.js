/**
 * Detalhes do projeto (paginas/detalhes-projeto/index.html?id=N).
 *
 * Depende de api.js, user-header.js (getInitials), public-header.js (publicUserPromise),
 * projects.js e vagas.js (loadVacanciesSection). GET /projects/{id} é público; as ações abaixo
 * exigem ser o responsável:
 * - "Editar projeto" → projeto-form?id=N;
 * - "Encerrar projeto" → POST /projects/{id}/close (após confirmação; não há reabertura).
 * Projeto encerrado continua visível, com aviso, e sem ações de edição.
 */

const projectId = getProjectIdFromUrl();

const projectLoading = document.getElementById("project-loading");
const projectError = document.getElementById("project-error");
const projectErrorMessage = document.getElementById("project-error-message");
const projectContent = document.getElementById("project-content");
const projectActionError = document.getElementById("project-action-error");
const projectClosedNotice = document.getElementById("project-closed-notice");
const projectFields = {
    status: document.getElementById("project-status"),
    title: document.getElementById("project-title"),
    owner: document.getElementById("project-owner"),
    description: document.getElementById("project-description"),
    github: document.getElementById("project-github"),
    edit: document.getElementById("project-edit"),
    close: document.getElementById("project-close"),
    ownerInitials: document.getElementById("owner-initials"),
    ownerName: document.getElementById("owner-name"),
    ownerUsername: document.getElementById("owner-username"),
};

let currentProject = null;
let viewer = null; // usuário autenticado (GET /me) ou null

function isProjectOwner(project) {
    return viewer !== null && viewer.id === project.owner.id;
}

function showPageError(message) {
    projectLoading.hidden = true;
    projectContent.hidden = true;
    projectErrorMessage.textContent = message;
    projectError.hidden = false;
}

function renderProject(project) {
    currentProject = project;
    const open = project.status === "OPEN";
    const ownerName = getOwnerName(project.owner);

    document.title = `${project.title} - CodeGuild`;
    projectFields.status.textContent = PROJECT_STATUS_LABELS[project.status] || project.status;
    projectFields.status.classList.toggle("match", open);
    projectFields.title.textContent = project.title;
    projectFields.owner.textContent = `Criado por: ${ownerName}`;
    projectFields.description.textContent = project.description;

    const githubUrl = project.github_url ? safeProjectGithubUrl(project.github_url) : null;
    projectFields.github.hidden = !githubUrl;
    if (githubUrl) {
        projectFields.github.href = githubUrl;
    }

    const canManage = open && isProjectOwner(project);
    projectFields.edit.hidden = !canManage;
    projectFields.close.hidden = !canManage;
    if (canManage) {
        projectFields.edit.href = projectFormUrl(project.id);
    }
    projectClosedNotice.hidden = open;

    projectFields.ownerInitials.textContent = getInitials(ownerName);
    projectFields.ownerName.textContent = ownerName;
    projectFields.ownerUsername.textContent = `@${project.owner.username}`;

    projectLoading.hidden = true;
    projectError.hidden = true;
    projectContent.hidden = false;
    loadVacanciesSection(project, viewer);
}

function closeErrorMessage(error) {
    if (!(error instanceof ApiError)) {
        return "Ocorreu um erro inesperado. Tente novamente.";
    }
    if (error.status === 0) {
        return "Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.";
    }
    if ([403, 404, 409].includes(error.status)) {
        return `${error.message}.`;
    }
    return "Não foi possível encerrar o projeto agora. Tente novamente.";
}

async function handleCloseProject() {
    const confirmed = window.confirm(
        `Encerrar o projeto "${currentProject.title}"?\n\nAs vagas abertas também serão encerradas e o projeto não poderá ser reaberto.`,
    );
    if (!confirmed) {
        return;
    }

    projectActionError.hidden = true;
    projectFields.close.disabled = true;
    try {
        renderProject(await apiFetch(`/projects/${currentProject.id}/close`, { method: "POST", auth: true }));
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return; // apiFetch já encerrou a sessão e redirecionou ao login
        }
        projectActionError.textContent = closeErrorMessage(error);
        projectActionError.hidden = false;
    } finally {
        projectFields.close.disabled = false;
    }
}

async function loadProjectPage() {
    if (projectId === null) {
        showPageError("Projeto não encontrado.");
        return;
    }
    try {
        const [project, user] = await Promise.all([apiFetch(`/projects/${projectId}`), publicUserPromise]);
        viewer = user;
        renderProject(project);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            showPageError("Projeto não encontrado. Ele pode ter sido removido ou o link está incorreto.");
        } else if (error instanceof ApiError && error.status === 0) {
            showPageError("Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.");
        } else {
            showPageError("Não foi possível carregar o projeto agora. Tente novamente.");
        }
    }
}

projectFields.close.addEventListener("click", handleCloseProject);
loadProjectPage();
