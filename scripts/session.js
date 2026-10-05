/**
 * Sessão das páginas privadas (painel, minhas-candidaturas, perfil).
 *
 * Carregar no <head>, depois de auth.js, api.js e user-header.js: a verificação roda antes de o
 * corpo da página ser exibido, então sem sessão nada do conteúdo privado aparece.
 *
 * - requireAuth(): sem token válido → login
 * - GET /me: preenche nome e iniciais no header ([data-user-name], [data-user-initials])
 * - botões [data-logout]: encerram a sessão
 * - encerra a sessão sozinha quando o token expira com a página aberta
 *
 * Scripts da página usam getCurrentUser() para reaproveitar a mesma chamada a /me.
 * Nome, iniciais e botão "Sair" vêm de user-header.js (compartilhado com as páginas públicas).
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
        bindLogoutButtons();

        // 401 já é tratado em apiFetch (logout + login). Aqui sobram falhas de rede/servidor.
        getCurrentUser()
            .then(renderHeaderUser)
            .catch((error) => console.error("Não foi possível carregar o usuário:", error.message));
    });
}
