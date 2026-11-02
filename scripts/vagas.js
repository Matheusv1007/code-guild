/**
 * Seção "Vagas" dos detalhes do projeto (paginas/detalhes-projeto/index.html).
 *
 * Depende de api.js e projects.js. detalhes-projeto.js chama loadVacanciesSection(project, viewer)
 * sempre que (re)desenha o projeto (ex.: depois de encerrá-lo, as vagas também aparecem encerradas).
 *
 * - GET /projects/{id}/vacancies é público; cada vaga traz `available` e `accepts_applications`
 *   (vaga encerrada ou sem disponibilidade não aceita novas candidaturas);
 * - responsável com o projeto aberto: "Nova vaga", "Editar" e "Encerrar vaga"
 *   (POST /projects/{id}/vacancies, PUT /vacancies/{id}, POST /vacancies/{id}/close);
 * - demais usuários: "Candidatar-se" só nas vagas que aceitam candidaturas. O envio em si é do
 *   módulo de candidaturas (ainda sem API): o modal apenas avisa que não está disponível.
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

const VACANCY_QUANTITY_MAX = 50;

let vacancyProject = null;
let vacancyViewer = null;
let vacancies = [];
let editingVacancyId = null; // null = criando
let catalogPromise = null;

function canManageVacancies() {
    return vacancyProject.status === "OPEN" && vacancyViewer !== null && vacancyViewer.id === vacancyProject.owner.id;
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

/** Ação de quem não é o responsável: candidatar-se, entrar para se candidatar ou o motivo do bloqueio. */
function createApplyAction(vacancy) {
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
    } else if (vacancyViewer === null || vacancyViewer.id !== vacancyProject.owner.id) {
        actions.append(createApplyAction(vacancy));
    }

    footer.append(availability, actions);
    card.append(footer);
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

async function fetchVacancies() {
    vacanciesStatus.textContent = "Carregando vagas...";
    vacanciesStatus.hidden = false;
    try {
        vacancies = await apiFetch(`/projects/${vacancyProject.id}/vacancies`);
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

function openApplicationModal(vacancy) {
    if (!isAuthenticated()) {
        window.location.href = LOGIN_PAGE;
        return;
    }
    applicationProject.textContent = vacancyProject.title;
    applicationVacancy.textContent = vacancy.title;
    applicationMessage.value = "";
    applicationNotice.hidden = true;
    applicationModal.hidden = false;
    applicationMessage.focus();
}

function closeApplicationModal() {
    applicationModal.hidden = true;
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
// Candidaturas ainda não têm API: não simula sucesso.
applicationSubmit.addEventListener("click", () => {
    applicationNotice.hidden = false;
});
