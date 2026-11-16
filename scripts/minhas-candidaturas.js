/**
 * Minhas candidaturas (paginas/minhas-candidaturas/index.html).
 *
 * - GET /me/applications: candidaturas do usuário, mais recentes primeiro;
 * - abas filtram no próprio front (Todas mostra também as canceladas);
 * - "Cancelar candidatura" só nas pendentes (POST /applications/{id}/cancel, após confirmação).
 *
 * Depende de auth.js, api.js, session.js (página privada) e projects.js.
 */

const applicationsTabs = document.getElementById("applications-tabs");
const applicationsList = document.getElementById("applications-list");
const applicationsStatus = document.getElementById("applications-status");
const applicationsError = document.getElementById("applications-error");
const applicationsEmpty = document.getElementById("applications-empty");

const FILTER_EMPTY_MESSAGES = {
    PENDING: "Nenhuma candidatura pendente.",
    APPROVED: "Nenhuma candidatura aprovada ainda.",
    REJECTED: "Nenhuma candidatura rejeitada.",
};

let myApplications = [];
let currentFilter = "ALL";

function formatDate(value) {
    return new Date(value).toLocaleDateString("pt-BR");
}

function createApplicationCard(application) {
    const card = createElement("article", "card app-card");

    const info = createElement("div", "app-info");
    const icon = createElement("div", "app-icon", application.project_title.trim().charAt(0).toUpperCase());
    icon.setAttribute("aria-hidden", "true");
    const text = createElement("div");
    text.append(
        createElement("h3", null, application.project_title),
        createElement("p", null, `${application.vacancy_title} · enviada em ${formatDate(application.created_at)}`),
    );
    const closed = application.vacancy_status !== "OPEN" || application.project_status !== "OPEN";
    if (application.status === "PENDING" && closed) {
        text.append(createElement("p", "app-note", "A vaga foi encerrada antes de uma resposta."));
    }
    info.append(icon, text);

    const actions = createElement("div", "app-actions");
    const link = createElement("a", "view-link", "Ver projeto");
    link.href = projectDetailsUrl(application.project_id);
    actions.append(createApplicationStatusBadge(application.status), link);
    if (application.status === "PENDING") {
        const cancel = createElement("button", "btn btn-outline cancel-btn", "Cancelar candidatura");
        cancel.type = "button";
        cancel.addEventListener("click", () => handleCancel(application, cancel));
        actions.append(cancel);
    }

    card.append(info, actions);
    return card;
}

function renderApplications() {
    applicationsStatus.hidden = true;
    if (myApplications.length === 0) {
        applicationsTabs.hidden = true;
        applicationsList.replaceChildren();
        applicationsEmpty.hidden = false;
        return;
    }
    applicationsEmpty.hidden = true;
    applicationsTabs.hidden = false;

    const visible = currentFilter === "ALL"
        ? myApplications
        : myApplications.filter((application) => application.status === currentFilter);
    applicationsList.replaceChildren(...visible.map(createApplicationCard));
    if (visible.length === 0) {
        applicationsStatus.textContent = FILTER_EMPTY_MESSAGES[currentFilter];
        applicationsStatus.hidden = false;
    }
}

function selectFilter(filter) {
    currentFilter = filter;
    applicationsTabs.querySelectorAll("[data-filter]").forEach((tab) => {
        const active = tab.dataset.filter === filter;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", String(active));
    });
    renderApplications();
}

async function handleCancel(application, button) {
    const question = `Cancelar sua candidatura para a vaga "${application.vacancy_title}" em "${application.project_title}"?`;
    if (!window.confirm(question)) {
        return;
    }
    applicationsError.hidden = true;
    button.disabled = true;
    try {
        const updated = await apiFetch(`/applications/${application.id}/cancel`, { method: "POST", auth: true });
        myApplications = myApplications.map((item) => (item.id === updated.id ? updated : item));
        renderApplications();
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return;
        }
        button.disabled = false;
        applicationsError.textContent = error instanceof ApiError && [403, 404, 409].includes(error.status)
            ? `${error.message}.`
            : "Não foi possível cancelar a candidatura agora. Tente novamente.";
        applicationsError.hidden = false;
    }
}

async function loadApplications() {
    try {
        myApplications = await apiFetch("/me/applications", { auth: true });
        renderApplications();
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return;
        }
        applicationsStatus.hidden = true;
        applicationsError.textContent = error instanceof ApiError && error.status === 0
            ? "Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente."
            : "Não foi possível carregar suas candidaturas agora. Tente novamente.";
        applicationsError.hidden = false;
    }
}

applicationsTabs.querySelectorAll("[data-filter]").forEach((tab) => {
    tab.addEventListener("click", () => selectFilter(tab.dataset.filter));
});
loadApplications();
