/**
 * Seção "Vagas" dos detalhes do projeto (paginas/detalhes-projeto/index.html).
 *
 * Depende de api.js e projects.js. detalhes-projeto.js chama loadVacanciesSection(project, viewer)
 * sempre que (re)desenha o projeto (ex.: depois de encerrá-lo, as vagas também aparecem encerradas);
 * depois de aprovar alguém, chama loadTeam() de detalhes-projeto.js para atualizar a equipe.
 *
 * - GET /projects/{id}/vacancies é público; cada vaga traz `available` e `accepts_applications`
 *   (vaga encerrada ou sem disponibilidade não aceita novas candidaturas);
 * - responsável com o projeto aberto: "Nova vaga", "Editar" e "Encerrar vaga"
 *   (POST /projects/{id}/vacancies, PUT /vacancies/{id}, POST /vacancies/{id}/close);
 * - responsável: candidatos de cada vaga (GET /projects/{id}/applications), com "Aprovar" e
 *   "Rejeitar" nas pendentes (POST /applications/{id}/approve | reject);
 * - demais usuários: "Candidatar-se" nas vagas que aceitam candidaturas (modal → POST
 *   /vacancies/{id}/applications); quem já tem candidatura ativa na vaga vê o status dela
 *   (GET /me/applications).
 */

const vacancyNewButton = document.getElementById("vacancy-new");
const vacancyForm = document.getElementById("vacancy-form");
const vacancyFormTitle = document.getElementById("vacancy-form-title");
const vacancyFormError = document.getElementById("vacancy-form-error");
const vacancySubmit = document.getElementById("vacancy-submit");
const vacancyCancel = document.getElementById("vacancy-cancel");
const vacancyActionError = document.getElementById("vacancy-action-error");
const vacanciesStatus = document.getElementById("vacancies-status");
const vacanciesList = document.getElementById("vacancies-list");
const vacancyInputs = {
    title: document.getElementById("vacancy-title"),
    quantity: document.getElementById("vacancy-quantity"),
    level: document.getElementById("vacancy-level"),
    description: document.getElementById("vacancy-description"),
    technologies: document.getElementById("vacancy-technologies"),
};
const applicationModal = document.getElementById("application-modal");
const applicationProject = document.getElementById("application-project");
const applicationVacancy = document.getElementById("application-vacancy");
const applicationMessage = document.getElementById("application-message");
const applicationNotice = document.getElementById("application-notice");
const applicationSubmit = document.getElementById("application-submit");
const applicationDismiss = applicationModal.querySelector(".modal-footer [data-close-modal]");

const ACTIVE_APPLICATION_STATUSES = ["PENDING", "APPROVED"];

const VACANCY_QUANTITY_MAX = 50;

let vacancyProject = null;
let vacancyViewer = null;
let vacancies = [];
let editingVacancyId = null; // null = criando
let catalogPromise = null;
let viewerApplications = new Map(); // vaga → candidatura ativa do usuário logado (não responsável)
let projectApplications = []; // candidaturas do projeto, só para o responsável
let applyingVacancy = null; // vaga aberta no modal de candidatura

function isVacancyOwner() {
    return vacancyViewer !== null && vacancyViewer.id === vacancyProject.owner.id;
}

function canManageVacancies() {
    return vacancyProject.status === "OPEN" && isVacancyOwner();
}

function vacancyApiErrorMessage(error, fallback) {
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
    return fallback;
}

/** "Encerrada", "Preenchida" ou "2 de 3 vagas disponíveis". */
function availabilityLabel(vacancy) {
    if (vacancy.status !== "OPEN") {
        return "Vaga encerrada";
    }
    if (vacancy.available === 0) {
        return `Preenchida (${vacancy.filled} de ${vacancy.quantity})`;
    }
    const noun = vacancy.quantity === 1 ? "vaga disponível" : "vagas disponíveis";
    return `${vacancy.available} de ${vacancy.quantity} ${noun}`;
}

/** Ação de quem não é o responsável: status da própria candidatura, candidatar-se, entrar ou o motivo do bloqueio. */
function createApplyAction(vacancy) {
    const mine = viewerApplications.get(vacancy.id);
    if (mine) {
        const link = createElement(
            "a", "job-applied", mine.status === "APPROVED" ? "Você faz parte da equipe" : "Candidatura enviada",
        );
        link.href = MY_APPLICATIONS_PAGE;
        return link;
    }
    if (!vacancy.accepts_applications) {
        const reason = vacancy.status !== "OPEN" || vacancyProject.status !== "OPEN"
            ? "Não aceita candidaturas"
            : "Sem posições livres";
        return createElement("span", "job-unavailable", reason);
    }
    if (vacancyViewer === null) {
        const login = createElement("a", "btn btn-primary", "Entrar para se candidatar");
        login.href = LOGIN_PAGE;
        return login;
    }
    const apply = createElement("button", "btn btn-primary", "Candidatar-se");
    apply.type = "button";
    apply.addEventListener("click", () => openApplicationModal(vacancy));
    return apply;
}

/* ---------- Candidatos (responsável) ---------- */

function applicantName(applicant) {
    return (applicant.full_name || "").trim() || applicant.username;
}

function createCandidateItem(vacancy, application) {
    const { applicant } = application;
    const item = createElement("div", "candidate");

    const header = createElement("div", "candidate-header");
    const identity = createElement("div", "candidate-identity");
    const meta = [`@${applicant.username}`, applicant.level ? LEVEL_LABELS[applicant.level] : null].filter(Boolean);
    identity.append(createElement("strong", null, applicantName(applicant)), createElement("span", "candidate-meta", meta.join(" · ")));
    header.append(identity, createApplicationStatusBadge(application.status));
    item.append(header);

    if (applicant.mastered.length > 0) {
        item.append(createTechnologyTags(applicant.mastered, 6));
    }
    if (application.message) {
        item.append(createElement("p", "candidate-message", application.message));
    }
    if (applicant.github_username) {
        const github = createElement("a", "candidate-github", `github.com/${applicant.github_username}`);
        github.href = `https://github.com/${encodeURIComponent(applicant.github_username)}`;
        github.target = "_blank";
        github.rel = "noopener noreferrer";
        item.append(github);
    }

    if (application.status === "PENDING" && vacancyProject.status === "OPEN") {
        const actions = createElement("div", "candidate-actions");
        const reject = createElement("button", "btn btn-outline", "Rejeitar");
        reject.type = "button";
        reject.addEventListener("click", () => handleDecision(application, "reject", reject));
        actions.append(reject);
        if (vacancy.accepts_applications) {
            const approve = createElement("button", "btn btn-primary", "Aprovar");
            approve.type = "button";
            approve.addEventListener("click", () => handleDecision(application, "approve", approve));
            actions.append(approve);
        }
        item.append(actions);
    }
    return item;
}

/** Candidatos da vaga (sem os cancelados): pendentes primeiro, como a API devolve. */
function createCandidatesSection(vacancy) {
    const candidates = projectApplications.filter(
        (application) => application.vacancy_id === vacancy.id && application.status !== "CANCELED",
    );
    const section = createElement("div", "candidates");
    if (candidates.length === 0) {
        section.append(createElement("p", "candidates-empty", "Nenhum candidato ainda."));
        return section;
    }
    const pending = candidates.filter((application) => application.status === "PENDING").length;
    const title = pending > 0 ? `Candidatos (${candidates.length}) · ${pending} aguardando resposta` : `Candidatos (${candidates.length})`;
    section.append(createElement("h4", null, title));
    candidates.forEach((application) => section.append(createCandidateItem(vacancy, application)));
    return section;
}

async function handleDecision(application, action, button) {
    const name = applicantName(application.applicant);
    const question = action === "approve"
        ? `Aprovar ${name} para a vaga "${application.vacancy_title}"?\n\nA pessoa entra na equipe e ocupa uma posição da vaga.`
        : `Rejeitar a candidatura de ${name} para a vaga "${application.vacancy_title}"?`;
    if (!window.confirm(question)) {
        return;
    }
    vacancyActionError.hidden = true;
    button.disabled = true;
    try {
        await apiFetch(`/applications/${application.id}/${action}`, { method: "POST", auth: true });
        if (action === "approve") {
            loadTeam();
        }
        await fetchVacancies();
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return;
        }
        button.disabled = false;
        const fallback = action === "approve"
            ? "Não foi possível aprovar a candidatura agora. Tente novamente."
            : "Não foi possível rejeitar a candidatura agora. Tente novamente.";
        vacancyActionError.textContent = vacancyApiErrorMessage(error, fallback);
        vacancyActionError.hidden = false;
    }
}

function createVacancyCard(vacancy) {
    const card = createElement("article", "job-card");
    card.classList.toggle("is-unavailable", !vacancy.accepts_applications);

    const header = createElement("div", "job-header");
    header.append(
        createElement("h3", null, vacancy.title),
        createElement("span", "badge", vacancy.level ? LEVEL_LABELS[vacancy.level] : "Qualquer nível"),
    );
    card.append(header);

    if (vacancy.description) {
        card.append(createElement("p", "job-description", vacancy.description));
    }
    if (vacancy.technologies.length > 0) {
        const requirements = createElement("div", "requirements");
        requirements.append(createElement("strong", null, "Stack recomendada:"), createTechnologyTags(vacancy.technologies));
        card.append(requirements);
    }

    const footer = createElement("div", "job-footer");
    const availability = createElement("span", "job-availability", availabilityLabel(vacancy));
    availability.classList.toggle("is-open", vacancy.accepts_applications);
    const actions = createElement("div", "job-actions");

    if (canManageVacancies()) {
        if (vacancy.status === "OPEN") {
            const edit = createElement("button", "btn btn-outline", "Editar");
            edit.type = "button";
            edit.addEventListener("click", () => openVacancyForm(vacancy));
            const close = createElement("button", "btn btn-danger", "Encerrar vaga");
            close.type = "button";
            close.addEventListener("click", () => handleCloseVacancy(vacancy, close));
            actions.append(edit, close);
        }
    } else if (!isVacancyOwner()) {
        actions.append(createApplyAction(vacancy));
    }

    footer.append(availability, actions);
    card.append(footer);
    if (isVacancyOwner()) {
        card.append(createCandidatesSection(vacancy));
    }
    return card;
}

function renderVacancies() {
    vacanciesList.replaceChildren(...vacancies.map(createVacancyCard));
    if (vacancies.length === 0) {
        vacanciesStatus.textContent = canManageVacancies()
            ? "Nenhuma vaga anunciada ainda. Use \"Nova vaga\" para dizer quem a equipe procura."
            : "Este projeto ainda não anunciou vagas.";
        vacanciesStatus.hidden = false;
    } else {
        vacanciesStatus.hidden = true;
    }
}

/** Candidaturas que a tela precisa: todas do projeto (responsável) ou as ativas do usuário neste projeto. */
async function fetchApplications() {
    viewerApplications = new Map();
    projectApplications = [];
    if (vacancyViewer === null) {
        return;
    }
    try {
        if (isVacancyOwner()) {
            projectApplications = await apiFetch(`/projects/${vacancyProject.id}/applications`, { auth: true });
            return;
        }
        const mine = await apiFetch("/me/applications", { auth: true });
        mine.filter((application) => application.project_id === vacancyProject.id
            && ACTIVE_APPLICATION_STATUSES.includes(application.status))
            .forEach((application) => viewerApplications.set(application.vacancy_id, application));
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return;
        }
        vacancyActionError.textContent = "Não foi possível carregar as candidaturas agora. Recarregue a página.";
        vacancyActionError.hidden = false;
    }
}

async function fetchVacancies() {
    vacanciesStatus.textContent = "Carregando vagas...";
    vacanciesStatus.hidden = false;
    try {
        const [loaded] = await Promise.all([apiFetch(`/projects/${vacancyProject.id}/vacancies`), fetchApplications()]);
        vacancies = loaded;
        renderVacancies();
    } catch (error) {
        vacanciesList.replaceChildren();
        vacanciesStatus.textContent = vacancyApiErrorMessage(error, "Não foi possível carregar as vagas agora. Tente novamente.");
    }
}

/** Chamado por detalhes-projeto.js a cada renderização do projeto. */
function loadVacanciesSection(project, viewer) {
    vacancyProject = project;
    vacancyViewer = viewer;
    vacancyNewButton.hidden = !canManageVacancies();
    vacancyActionError.hidden = true;
    if (!canManageVacancies()) {
        closeVacancyForm();
    }
    fetchVacancies();
}

/* ---------- Formulário (responsável) ---------- */

function loadCatalog() {
    if (!catalogPromise) {
        catalogPromise = apiFetch("/technologies").then((catalog) => {
            vacancyInputs.technologies.replaceChildren(...catalog.map((technology) => {
                const label = createElement("label", "tech-option");
                const input = document.createElement("input");
                input.type = "checkbox";
                input.value = String(technology.id);
                label.append(input, createElement("span", null, technology.name));
                return label;
            }));
        });
        catalogPromise.catch(() => {
            catalogPromise = null; // tenta de novo na próxima abertura
        });
    }
    return catalogPromise;
}

function technologyInputs() {
    return Array.from(vacancyInputs.technologies.querySelectorAll("input[type='checkbox']"));
}

async function openVacancyForm(vacancy = null) {
    editingVacancyId = vacancy ? vacancy.id : null;
    vacancyFormTitle.textContent = vacancy ? `Editar vaga: ${vacancy.title}` : "Nova vaga";
    vacancySubmit.textContent = vacancy ? "Salvar alterações" : "Criar vaga";
    vacancyFormError.hidden = true;
    vacancyActionError.hidden = true;

    vacancyInputs.title.value = vacancy ? vacancy.title : "";
    vacancyInputs.quantity.value = vacancy ? String(vacancy.quantity) : "1";
    vacancyInputs.level.value = vacancy && vacancy.level ? vacancy.level : "";
    vacancyInputs.description.value = vacancy && vacancy.description ? vacancy.description : "";
    vacancyForm.hidden = false;
    vacancyNewButton.hidden = true;

    try {
        await loadCatalog();
    } catch (error) {
        vacancyFormError.textContent = vacancyApiErrorMessage(error, "Não foi possível carregar o catálogo de tecnologias.");
        vacancyFormError.hidden = false;
    }
    const selected = new Set((vacancy ? vacancy.technologies : []).map((technology) => String(technology.id)));
    technologyInputs().forEach((input) => {
        input.checked = selected.has(input.value);
    });
    vacancyInputs.title.focus();
    vacancyForm.scrollIntoView({ block: "nearest" });
}

function closeVacancyForm() {
    vacancyForm.hidden = true;
    editingVacancyId = null;
    vacancyNewButton.hidden = !(vacancyProject && canManageVacancies());
}

function buildVacancyPayload() {
    return {
        title: vacancyInputs.title.value.trim(),
        quantity: Number(vacancyInputs.quantity.value),
        level: vacancyInputs.level.value || null,
        description: vacancyInputs.description.value.trim() || null,
        technology_ids: technologyInputs().filter((input) => input.checked).map((input) => Number(input.value)),
    };
}

function validateVacancyPayload(payload) {
    if (!payload.title) {
        return "Informe a especialidade da vaga (ex.: Backend Developer).";
    }
    if (payload.title.length > 120) {
        return "A especialidade pode ter no máximo 120 caracteres.";
    }
    if (!Number.isInteger(payload.quantity) || payload.quantity < 1 || payload.quantity > VACANCY_QUANTITY_MAX) {
        return `Informe uma quantidade inteira entre 1 e ${VACANCY_QUANTITY_MAX}.`;
    }
    if (payload.description && payload.description.length > 2000) {
        return "A descrição pode ter no máximo 2000 caracteres.";
    }
    return null;
}

async function handleVacancySubmit(event) {
    event.preventDefault();
    vacancyFormError.hidden = true;

    const payload = buildVacancyPayload();
    const validationError = validateVacancyPayload(payload);
    if (validationError) {
        vacancyFormError.textContent = validationError;
        vacancyFormError.hidden = false;
        return;
    }

    const label = vacancySubmit.textContent;
    vacancySubmit.disabled = true;
    vacancySubmit.textContent = "Salvando...";
    try {
        await apiFetch(
            editingVacancyId === null ? `/projects/${vacancyProject.id}/vacancies` : `/vacancies/${editingVacancyId}`,
            { method: editingVacancyId === null ? "POST" : "PUT", body: payload, auth: true },
        );
        closeVacancyForm();
        await fetchVacancies();
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return; // apiFetch já encerrou a sessão e redirecionou ao login
        }
        vacancyFormError.textContent = vacancyApiErrorMessage(error, "Não foi possível salvar a vaga agora. Tente novamente.");
        vacancyFormError.hidden = false;
    } finally {
        vacancySubmit.disabled = false;
        vacancySubmit.textContent = label;
    }
}

async function handleCloseVacancy(vacancy, button) {
    if (!window.confirm(`Encerrar a vaga "${vacancy.title}"?\n\nEla deixa de aceitar candidaturas e não poderá ser reaberta.`)) {
        return;
    }
    vacancyActionError.hidden = true;
    button.disabled = true;
    try {
        await apiFetch(`/vacancies/${vacancy.id}/close`, { method: "POST", auth: true });
        if (editingVacancyId === vacancy.id) {
            closeVacancyForm();
        }
        await fetchVacancies();
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return;
        }
        button.disabled = false;
        vacancyActionError.textContent = vacancyApiErrorMessage(error, "Não foi possível encerrar a vaga agora. Tente novamente.");
        vacancyActionError.hidden = false;
    }
}

/* ---------- Modal de candidatura ---------- */

function showApplicationNotice(kind, message, link = null) {
    applicationNotice.className = `modal-notice is-${kind}`;
    applicationNotice.replaceChildren(message);
    if (link) {
        const anchor = createElement("a", null, link.text);
        anchor.href = link.href;
        applicationNotice.append(" ", anchor);
    }
    applicationNotice.hidden = false;
}

function openApplicationModal(vacancy) {
    if (!isAuthenticated()) {
        window.location.href = LOGIN_PAGE;
        return;
    }
    applyingVacancy = vacancy;
    applicationProject.textContent = vacancyProject.title;
    applicationVacancy.textContent = vacancy.title;
    applicationMessage.value = "";
    applicationMessage.disabled = false;
    applicationNotice.hidden = true;
    applicationSubmit.hidden = false;
    applicationSubmit.disabled = false;
    applicationDismiss.textContent = "Cancelar";
    applicationModal.hidden = false;
    applicationMessage.focus();
}

function closeApplicationModal() {
    applicationModal.hidden = true;
    applyingVacancy = null;
}

async function handleApplicationSubmit() {
    const message = applicationMessage.value.trim();
    applicationSubmit.disabled = true;
    try {
        await apiFetch(`/vacancies/${applyingVacancy.id}/applications`, {
            method: "POST",
            auth: true,
            body: { message: message || null },
        });
        applicationSubmit.hidden = true;
        applicationMessage.disabled = true;
        applicationDismiss.textContent = "Fechar";
        showApplicationNotice("success", "Candidatura enviada! O responsável pelo projeto vai avaliar seu perfil.", {
            text: "Ver minhas candidaturas", href: MY_APPLICATIONS_PAGE,
        });
        fetchVacancies();
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return;
        }
        applicationSubmit.disabled = false;
        const text = vacancyApiErrorMessage(error, "Não foi possível enviar a candidatura agora. Tente novamente.");
        const needsProfile = error instanceof ApiError && error.status === 409 && error.message.includes("perfil");
        showApplicationNotice("error", text, needsProfile ? { text: "Criar meu perfil", href: "../perfil/index.html" } : null);
    }
}

vacancyNewButton.addEventListener("click", () => openVacancyForm());
vacancyCancel.addEventListener("click", closeVacancyForm);
vacancyForm.addEventListener("submit", handleVacancySubmit);

applicationModal.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeApplicationModal);
});
applicationModal.addEventListener("click", (event) => {
    if (event.target === applicationModal) {
        closeApplicationModal();
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !applicationModal.hidden) {
        closeApplicationModal();
    }
});
applicationSubmit.addEventListener("click", handleApplicationSubmit);
