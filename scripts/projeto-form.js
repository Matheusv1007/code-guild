/**
 * Criar ou editar projeto (paginas/projeto-form/index.html).
 *
 * Depende de session.js (hasSession, getCurrentUser), api.js e projects.js.
 * - sem ?id: modo criação → POST /projects (o usuário autenticado vira o responsável);
 * - com ?id=N: modo edição → GET /projects/N preenche o formulário e PUT /projects/N salva.
 *   Só o responsável edita, e só enquanto o projeto está aberto (o backend também valida).
 * Ao salvar, vai para a página de detalhes do projeto.
 */

const GITHUB_PROJECT_URL_PATTERN = /^https:\/\/github\.com\/[A-Za-z0-9-]+(\/[A-Za-z0-9._-]+)?\/?$/;

const editingProjectId = getProjectIdFromUrl();
const projectForm = document.getElementById("project-form");
const projectFormTitle = document.getElementById("project-form-title");
const projectFormSubtitle = document.getElementById("project-form-subtitle");
const projectLoading = document.getElementById("project-loading");
const projectLoadError = document.getElementById("project-load-error");
const projectLoadErrorMessage = document.getElementById("project-load-error-message");
const projectError = document.getElementById("project-error");
const projectSubmit = document.getElementById("project-submit");
const projectBack = document.getElementById("project-back");
const projectCancel = document.getElementById("project-cancel");
const projectInputs = {
    title: document.getElementById("title"),
    description: document.getElementById("description"),
    githubUrl: document.getElementById("github_url"),
};

function showFormError(message) {
    projectError.textContent = message;
    projectError.hidden = false;
}

function showLoadError(message) {
    projectLoading.hidden = true;
    projectForm.hidden = true;
    projectLoadErrorMessage.textContent = message;
    projectLoadError.hidden = false;
}

function buildProjectPayload() {
    return {
        title: projectInputs.title.value.trim(),
        description: projectInputs.description.value.trim(),
        github_url: projectInputs.githubUrl.value.trim() || null,
    };
}

/** Retorna a mensagem do primeiro problema encontrado ou null se estiver tudo certo. */
function validateProjectPayload(payload) {
    if (!payload.title) {
        return "Informe o título do projeto.";
    }
    if (payload.title.length > 120) {
        return "O título pode ter no máximo 120 caracteres.";
    }
    if (!payload.description) {
        return "Descreva o projeto.";
    }
    if (payload.description.length > 5000) {
        return "A descrição pode ter no máximo 5000 caracteres.";
    }
    if (payload.github_url && !GITHUB_PROJECT_URL_PATTERN.test(payload.github_url)) {
        return "Informe o link do GitHub no formato https://github.com/usuario/repositorio.";
    }
    return null;
}

function saveErrorMessage(error) {
    if (!(error instanceof ApiError)) {
        return "Ocorreu um erro inesperado. Tente novamente.";
    }
    if (error.status === 0) {
        return "Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.";
    }
    if (error.status === 422) {
        return `Dados inválidos: ${error.message.replace(/Value error, /g, "")}`;
    }
    if ([403, 404, 409].includes(error.status)) {
        return `${error.message}.`;
    }
    return "Não foi possível salvar o projeto agora. Tente novamente.";
}

/** Modo edição: confere responsável e status antes de mostrar o formulário. */
async function loadProjectForEditing() {
    projectForm.hidden = true;
    projectLoading.hidden = false;

    projectFormTitle.textContent = "Editar projeto";
    projectFormSubtitle.textContent = "Atualize as informações do projeto.";
    projectSubmit.textContent = "Salvar alterações";
    const detailsUrl = projectDetailsUrl(editingProjectId);
    projectBack.href = detailsUrl;
    projectBack.textContent = "\u2190 Voltar ao projeto";
    projectCancel.href = detailsUrl;

    try {
        const [project, user] = await Promise.all([apiFetch(`/projects/${editingProjectId}`), getCurrentUser()]);
        if (project.owner.id !== user.id) {
            showLoadError("Apenas o responsável pelo projeto pode editá-lo.");
            return;
        }
        if (project.status !== "OPEN") {
            showLoadError("Este projeto foi encerrado e não pode mais ser editado.");
            return;
        }
        document.title = `Editar ${project.title} - CodeGuild`;
        projectInputs.title.value = project.title;
        projectInputs.description.value = project.description;
        projectInputs.githubUrl.value = project.github_url || "";
        projectLoading.hidden = true;
        projectForm.hidden = false;
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return; // apiFetch já encerrou a sessão e redirecionou ao login
        }
        if (error instanceof ApiError && error.status === 404) {
            showLoadError("Projeto não encontrado.");
        } else if (error instanceof ApiError && error.status === 0) {
            showLoadError("Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.");
        } else {
            showLoadError("Não foi possível carregar o projeto agora. Tente novamente.");
        }
    }
}

async function handleProjectSubmit(event) {
    event.preventDefault();
    projectError.hidden = true;

    const payload = buildProjectPayload();
    const validationError = validateProjectPayload(payload);
    if (validationError) {
        showFormError(validationError);
        return;
    }

    const label = projectSubmit.textContent;
    projectSubmit.disabled = true;
    projectSubmit.textContent = "Salvando...";

    try {
        const project = await apiFetch(editingProjectId === null ? "/projects" : `/projects/${editingProjectId}`, {
            method: editingProjectId === null ? "POST" : "PUT",
            body: payload,
            auth: true,
        });
        window.location.href = projectDetailsUrl(project.id);
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return; // apiFetch já encerrou a sessão e redirecionou ao login
        }
        showFormError(saveErrorMessage(error));
        projectSubmit.disabled = false;
        projectSubmit.textContent = label;
    }
}

if (hasSession) {
    projectForm.addEventListener("submit", handleProjectSubmit);
    if (editingProjectId !== null) {
        loadProjectForEditing();
    } else if (new URLSearchParams(window.location.search).has("id")) {
        showLoadError("Projeto não encontrado.");
    }
}
