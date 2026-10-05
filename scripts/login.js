/**
 * Login da página paginas/login/index.html.
 *
 * Envia username + senha para POST /login, salva o token e redireciona ao painel.
 * Depende de auth.js (saveToken) e api.js (apiFetch, ApiError) carregados antes.
 */

const PAINEL_PAGE = "../painel/index.html";

// Já logado: não faz sentido ver o formulário de novo.
redirectIfAuthenticated();

const loginForm = document.querySelector(".auth-form");
const loginError = document.getElementById("login-error");
const loginButton = loginForm.querySelector("button[type='submit']");

function showLoginError(message) {
    loginError.textContent = message;
    loginError.hidden = false;
}

function hideLoginError() {
    loginError.textContent = "";
    loginError.hidden = true;
}

function loginErrorMessage(error) {
    if (!(error instanceof ApiError)) {
        return "Ocorreu um erro inesperado. Tente novamente.";
    }
    if (error.status === 0) {
        return "Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.";
    }
    if (error.status === 401) {
        return "Usuário ou senha incorretos.";
    }
    if (error.status === 422) {
        return "Dados inválidos. Preencha usuário e senha corretamente.";
    }
    return error.message;
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideLoginError();

    const username = loginForm.username.value.trim();
    const password = loginForm.password.value;

    if (!username || !password) {
        showLoginError("Preencha usuário e senha.");
        return;
    }

    loginButton.disabled = true;

    try {
        const data = await apiFetch("/login", {
            method: "POST",
            body: { username, password },
        });
        saveToken(data.access_token);
        window.location.href = PAINEL_PAGE;
    } catch (error) {
        showLoginError(loginErrorMessage(error));
        loginButton.disabled = false;
    }
});
