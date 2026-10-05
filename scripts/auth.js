/**
 * Funções-base de autenticação do frontend CodeGuild.
 *
 * O token JWT retornado por POST /login fica no localStorage do navegador.
 * O localStorage é separado por origem: use sempre http://127.0.0.1:5500
 * (e não localhost:5500), senão o token salvo "some" ao trocar de endereço.
 *
 * Ordem de carregamento nas páginas: auth.js antes de api.js.
 */

const TOKEN_KEY = "codeguild_token";

// Rotas compartilhadas: caminhos relativos válidos a partir de qualquer paginas/<tela>/index.html.
// Páginas privadas carregam scripts/session.js; inicio, explorar e detalhes-projeto, scripts/public-header.js.
const LOGIN_PAGE = "../login/index.html";
const HOME_PAGE = "../painel/index.html"; // início de quem está logado
const GUEST_HOME_PAGE = "../inicio/index.html"; // início do visitante (landing)

function saveToken(token) {
    try {
        localStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
        console.error("Não foi possível salvar o token:", error);
    }
}

function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch (error) {
        return null;
    }
}

function removeToken() {
    try {
        localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
        console.error("Não foi possível remover o token:", error);
    }
}

/**
 * Lê o campo "exp" do JWT (sem validar assinatura — quem valida é o backend).
 * Retorna o timestamp em segundos ou null se o token for ilegível.
 */
function getTokenExpiration(token) {
    try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(atob(payload)).exp ?? null;
    } catch (error) {
        return null;
    }
}

/** true se existe token e ele ainda não expirou (o backend usa 30 min). */
function isAuthenticated() {
    const token = getToken();
    if (!token) {
        return false;
    }
    const exp = getTokenExpiration(token);
    if (exp !== null && exp * 1000 <= Date.now()) {
        removeToken();
        return false;
    }
    return true;
}

/**
 * Páginas privadas: sem sessão válida, vai direto ao login.
 * Usa replace() para a página privada não ficar no histórico (o "voltar" não a reabre).
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.replace(LOGIN_PAGE);
        return false;
    }
    return true;
}

/** Página de login: com sessão válida, vai direto ao painel. */
function redirectIfAuthenticated() {
    if (isAuthenticated()) {
        window.location.replace(HOME_PAGE);
        return true;
    }
    return false;
}

/**
 * Encerra a sessão: apaga o token e volta ao login.
 * Usada pelo botão "Sair" e quando a API recusa o token (401). O JWT é stateless,
 * então não há chamada ao backend.
 */
function logout() {
    removeToken();
    window.location.replace(LOGIN_PAGE);
}
