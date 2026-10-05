/**
 * Header das páginas públicas (explorar, detalhes-projeto) ciente da sessão.
 *
 * A página continua acessível sem login (não usa requireAuth()).
 * - sem sessão: mostra [data-guest-only] ("Entrar"); [data-home-link] ("Início") → landing;
 * - com sessão: mostra [data-auth-only] ("Meus Projetos", "Meu Perfil", nome, iniciais, "Sair"),
 *   [data-home-link] → painel, e busca GET /me;
 * - token expirado ou recusado (401): apaga o token e volta ao estado anônimo, sem redirecionar.
 *
 * Carregar no fim do <body>, depois de auth.js, api.js e user-header.js.
 */

// "Início" do visitante: landing pública (o logado vai para HOME_PAGE, o painel, de auth.js).
const GUEST_HOME_PAGE = "../inicio/index.html";

/**
 * Mostra só os itens do estado atual. Além do atributo hidden, usa display inline:
 * o resultado não depende de o navegador ter a versão nova do global.css (cache).
 * Também aponta [data-home-link] para o painel ou para a landing.
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

async function initPublicHeader() {
    // isAuthenticated() já apaga token expirado.
    if (!isAuthenticated()) {
        setHeaderSession(false);
        return;
    }

    setHeaderSession(true);
    bindLogoutButtons();

    try {
        // Sem a opção `auth`: em página pública um 401 não deve levar ao login.
        const user = await apiFetch("/me", { headers: { Authorization: `Bearer ${getToken()}` } });
        renderHeaderUser(user);
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            removeToken();
            setHeaderSession(false);
            return;
        }
        // API fora do ar: mantém o estado logado (Sair continua disponível), sem nome.
        console.error("Não foi possível carregar o usuário:", error.message);
    }
}

initPublicHeader();
