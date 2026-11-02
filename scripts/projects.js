/**
 * Utilidades de projetos compartilhadas por explorar, detalhes-projeto, painel e projeto-form.
 *
 * Só monta elementos e textos; quem chama a API é o script de cada tela.
 * Textos vindos da API sempre entram via textContent (nunca innerHTML).
 */

const PROJECT_DETAILS_PAGE = "../detalhes-projeto/index.html";
const PROJECT_FORM_PAGE = "../projeto-form/index.html";

const PROJECT_STATUS_LABELS = { OPEN: "Aberto", CLOSED: "Encerrado" };

function projectDetailsUrl(projectId) {
    return `${PROJECT_DETAILS_PAGE}?id=${encodeURIComponent(projectId)}`;
}

function projectFormUrl(projectId) {
    return `${PROJECT_FORM_PAGE}?id=${encodeURIComponent(projectId)}`;
}

/** Id numérico do parâmetro ?id= da URL atual, ou null se ausente/inválido. */
function getProjectIdFromUrl() {
    const value = new URLSearchParams(window.location.search).get("id");
    return value && /^\d+$/.test(value) ? Number(value) : null;
}

/** Nome do perfil do responsável ou, sem perfil, o username. */
function getOwnerName(owner) {
    return (owner.full_name || "").trim() || owner.username;
}

/** Elemento com classe e texto opcionais. */
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (text !== undefined && text !== null) {
        element.textContent = text;
    }
    return element;
}

/** Badge de status; "Aberto" usa o destaque verde. */
function createStatusBadge(status) {
    const badge = createElement("span", "badge", PROJECT_STATUS_LABELS[status] || status);
    badge.classList.toggle("match", status === "OPEN");
    return badge;
}

/** Só links https://github.com entram em href (o valor vem do usuário). */
function safeProjectGithubUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.origin === "https://github.com" ? parsed.href : null;
    } catch {
        return null;
    }
}

/** Mensagem amigável para falhas de carregamento (rede, servidor). */
function describeProjectsLoadError(error) {
    if (error instanceof ApiError && error.status === 0) {
        return "Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.";
    }
    return "Não foi possível carregar os projetos agora. Tente novamente.";
}
