/**
 * Sessão das páginas privadas (painel, minhas-candidaturas).
 *
 * Carregar no <head>, depois de auth.js e api.js: a verificação roda antes de o
 * corpo da página ser exibido, então sem sessão nada do conteúdo privado aparece.
 *
 * - requireAuth(): sem token válido → login
 * - GET /me: preenche nome e iniciais no header ([data-user-name], [data-user-initials])
 * - botões [data-logout]: encerram a sessão
 * - encerra a sessão sozinha quando o token expira com a página aberta
 *
 * Scripts da página usam getCurrentUser() para reaproveitar a mesma chamada a /me.
 */

const hasSession = requireAuth();

if (!hasSession) {
    // Evita mostrar a página por um instante enquanto o navegador redireciona.
    document.documentElement.style.visibility = "hidden";
}

let currentUserPromise = null;

/** Usuário autenticado (GET /me), buscado uma única vez por página. */
function getCurrentUser() {
    if (!currentUserPromise) {
        currentUserPromise = apiFetch("/me", { auth: true });
    }
    return currentUserPromise;
}

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

/** Encerra a sessão no instante em que o token expira (se a página ficar aberta). */
function scheduleSessionExpiry() {
    const exp = getTokenExpiration(getToken());
    if (exp !== null) {
        setTimeout(logout, Math.max(exp * 1000 - Date.now(), 0));
    }
}

if (hasSession) {
    scheduleSessionExpiry();

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("[data-logout]").forEach((button) => {
            button.addEventListener("click", logout);
        });

        // 401 já é tratado em apiFetch (logout + login). Aqui sobram falhas de rede/servidor.
        getCurrentUser()
            .then(renderHeaderUser)
            .catch((error) => console.error("Não foi possível carregar o usuário:", error.message));
    });
}
