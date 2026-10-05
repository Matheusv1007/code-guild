/**
 * Cadastro da página paginas/cadastro/index.html.
 *
 * Envia username + email + senha para POST /register (cria só a conta, sem perfil)
 * e, em caso de sucesso, leva ao login.
 * Depende de auth.js (redirectIfAuthenticated) e api.js (apiFetch, ApiError) carregados antes.
 */

const LOGIN_REDIRECT_DELAY_MS = 1500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Já logado: não faz sentido criar outra conta.
redirectIfAuthenticated();

const registerForm = document.querySelector(".auth-form");
const registerError = document.getElementById("register-error");
const registerSuccess = document.getElementById("register-success");
const registerButton = registerForm.querySelector("button[type='submit']");

function showRegisterError(message) {
    registerSuccess.hidden = true;
    registerError.textContent = message;
    registerError.hidden = false;
}

function showRegisterSuccess(message) {
    registerError.hidden = true;
    registerSuccess.textContent = message;
    registerSuccess.hidden = false;
}

function hideRegisterMessages() {
    registerError.hidden = true;
    registerSuccess.hidden = true;
}

/** Retorna a mensagem do primeiro problema encontrado ou null se estiver tudo certo. */
function validateRegisterForm({ username, email, password, passwordConfirm }) {
    if (!username || !email || !password || !passwordConfirm) {
        return "Preencha todos os campos.";
    }
    if (!EMAIL_PATTERN.test(email)) {
        return "Informe um email válido.";
    }
    if (password !== passwordConfirm) {
        return "As senhas não coincidem.";
    }
    return null;
}

function registerErrorMessage(error) {
    if (!(error instanceof ApiError)) {
        return "Ocorreu um erro inesperado. Tente novamente.";
    }
    if (error.status === 0) {
        return "Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.";
    }
    if (error.status === 400) {
        // Única regra de negócio do backend hoje: username único.
        return "Este nome de usuário já está em uso. Escolha outro.";
    }
    if (error.status === 422) {
        return "Dados inválidos. Revise os campos e tente novamente.";
    }
    return "Não foi possível criar a conta agora. Tente novamente.";
}

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideRegisterMessages();

    const fields = {
        username: registerForm.username.value.trim(),
        email: registerForm.email.value.trim(),
        password: registerForm.password.value,
        passwordConfirm: registerForm.password_confirm.value,
    };

    const validationError = validateRegisterForm(fields);
    if (validationError) {
        showRegisterError(validationError);
        return;
    }

    registerButton.disabled = true;

    try {
        await apiFetch("/register", {
            method: "POST",
            body: { username: fields.username, email: fields.email, password: fields.password },
        });
        showRegisterSuccess("Conta criada com sucesso! Redirecionando para o login...");
        setTimeout(() => {
            window.location.href = LOGIN_PAGE;
        }, LOGIN_REDIRECT_DELAY_MS);
    } catch (error) {
        showRegisterError(registerErrorMessage(error));
        registerButton.disabled = false;
    }
});
