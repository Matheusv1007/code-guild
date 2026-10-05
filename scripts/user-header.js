/**
 * Usuário no header: nome, iniciais e botão "Sair".
 *
 * Compartilhado pelas páginas privadas (session.js) e públicas (public-header.js).
 * Só exibe dados; não decide se há sessão. Depende de auth.js (logout).
 *
 * - [data-user-name]: nome completo do perfil ou username
 * - [data-user-initials]: iniciais do mesmo nome
 * - [data-logout]: encerra a sessão
 */

/** Nome completo do perfil ou, sem perfil, o username. */
function getDisplayName(user) {
    const fullName = user.profile && user.profile.full_name ? user.profile.full_name.trim() : "";
    return fullName || user.username;
}

/** Primeiro nome do perfil ou, sem perfil, o username. */
function getFirstName(user) {
    return getDisplayName(user).split(/\s+/)[0];
}

/**
 * Iniciais para o avatar: primeira letra da primeira e da última palavra.
 * "Pedro Simon" → "PS", "guilherme.silva" → "GS", "pedro" → "P".
 */
function getInitials(name) {
    const parts = name.split(/[\s._-]+/).filter(Boolean);
    if (parts.length === 0) {
        return "?";
    }
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
}

function renderHeaderUser(user) {
    const name = getDisplayName(user);
    document.querySelectorAll("[data-user-name]").forEach((element) => {
        element.textContent = name;
    });
    document.querySelectorAll("[data-user-initials]").forEach((element) => {
        element.textContent = getInitials(name);
        element.title = name;
    });
}

function bindLogoutButtons() {
    document.querySelectorAll("[data-logout]").forEach((button) => {
        button.addEventListener("click", logout);
    });
}
