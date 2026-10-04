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

// Caminho relativo válido a partir de qualquer paginas/<tela>/index.html
const LOGIN_PAGE = "../login/index.html";

// Definição de páginas (pasta em paginas/). A proteção ainda não é aplicada.
const PUBLIC_PAGES = ["inicio", "login", "explorar", "detalhes-projeto"];
const PRIVATE_PAGES = ["painel", "minhas-candidaturas", "perfil"];

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
 * Para uso futuro nas páginas privadas: redireciona ao login se não houver sessão.
 * Ainda NÃO é chamada por nenhuma página.
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = LOGIN_PAGE;
        return false;
    }
    return true;
}
