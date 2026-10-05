/**
 * Header das páginas públicas (inicio, explorar, detalhes-projeto) ciente da sessão.
 *
 * A página continua acessível sem login (não usa requireAuth()).
 * - sem sessão: mostra [data-guest-only] ("Entrar", "Entrar para se candidatar");
 *   [data-home-link] (logo e "Início") → landing;
 * - com sessão: mostra [data-auth-only] ("Minhas Candidaturas", "Meu Perfil", nome, iniciais, "Sair",
 *   "Candidatar-se"); [data-home-link] → painel, e busca GET /me;
 * - token expirado (ao abrir ou com a página aberta) ou recusado (401): apaga o token e volta ao
 *   estado anônimo, sem redirecionar.
 *
 * Carregar no fim do <body>, depois de auth.js, api.js e user-header.js.
 */

/**
 * Mostra só os itens do estado atual. Além do atributo hidden, usa display inline:
 * o resultado não depende de o navegador ter a versão nova do global.css (cache).
 * Também aponta [data-home-link] (logo e "Início") para HOME_PAGE ou GUEST_HOME_PAGE (auth.js).
 */
function setHeaderSession(loggedIn) {
    const toggle = (element, visible) => {
        element.hidden = !visible;
        element.style.display = visible ? "" : "none";
    };
    document.querySelectorAll("[data-auth-only]").forEach((element) => toggle(element, loggedIn));
    document.querySelectorAll("[data-guest-only]").forEach((element) => toggle(element, !loggedIn));
    document.querySelectorAll("[data-home-link]").forEach((link) => {
        link.setAttribute("href", loggedIn ? HOME_PAGE : GUEST_HOME_PAGE);
    });
}

/** Sessão encerrada numa página pública: continua na página, agora como visitante. */
function endPublicSession() {
    removeToken();
    setHeaderSession(false);
}

/** Equivalente ao scheduleSessionExpiry() de session.js, mas sem levar ao login. */
function schedulePublicSessionExpiry() {
    const token = getToken();
    const exp = getTokenExpiration(token);
    if (exp !== null) {
        setTimeout(() => {
            // Outro login (em outra aba) pode ter trocado o token: só encerra o que expirou.
            if (getToken() === token) {
                endPublicSession();
            }
        }, Math.max(exp * 1000 - Date.now(), 0));
    }
}

async function initPublicHeader() {
    // isAuthenticated() já apaga token expirado.
    if (!isAuthenticated()) {
        setHeaderSession(false);
        return;
    }

    setHeaderSession(true);
    bindLogoutButtons();
    schedulePublicSessionExpiry();

    try {
        // Sem a opção `auth`: em página pública um 401 não deve levar ao login.
        const user = await apiFetch("/me", { headers: { Authorization: `Bearer ${getToken()}` } });
        renderHeaderUser(user);
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            endPublicSession();
            return;
        }
        // API fora do ar: mantém o estado logado (Sair continua disponível), sem nome.
        console.error("Não foi possível carregar o usuário:", error.message);
    }
}

initPublicHeader();
