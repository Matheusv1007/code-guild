/**
 * Cadastro da página paginas/cadastro/index.html.
 *
 * Envia username + email + senha para POST /register (cria só a conta, sem perfil)
 * e, em caso de sucesso, leva ao login.
 * Antes do lançamento (launch.js) esconde o formulário e mostra o aviso do pré-cadastro.
 * Depende de auth.js (redirectIfAuthenticated), api.js (apiFetch, ApiError) e launch.js carregados antes.
 */

const LOGIN_REDIRECT_DELAY_MS = 1500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mesmas regras do backend (models/user.py). O usuário é salvo em minúsculas.
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72; // limite do bcrypt; letra com acento ocupa 2 bytes

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

function getFieldError(name) {
    return document.getElementById(`${name}-error`);
}

function showFieldError(name, message) {
    const error = getFieldError(name);
    error.textContent = message;
    error.hidden = false;
    registerForm.elements[name].setAttribute("aria-invalid", "true");
}

function clearFieldError(name) {
    const error = getFieldError(name);
    error.textContent = "";
    error.hidden = true;
    registerForm.elements[name].removeAttribute("aria-invalid");
}

/** Mensagem de cada campo inválido, na ordem do formulário: { username: "...", password: "..." }. */
function validateRegisterForm({ username, email, password, passwordConfirm }) {
    const errors = {};
    if (!username) {
        errors.username = "Informe o usuário.";
    } else if (!USERNAME_PATTERN.test(username)) {
        errors.username = "Use de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado, sem espaços.";
    }
    if (!email) {
        errors.email = "Informe o email.";
    } else if (!EMAIL_PATTERN.test(email)) {
        errors.email = "Informe um email válido.";
    }
    if (!password) {
        errors.password = "Informe a senha.";
    } else if ([...password].length < PASSWORD_MIN_LENGTH) {
        errors.password = `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
    } else if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
        errors.password = `A senha deve ter no máximo ${PASSWORD_MAX_BYTES} bytes (letras com acento contam 2).`;
    }
    if (!passwordConfirm) {
        errors.password_confirm = "Confirme a senha.";
    } else if (password !== passwordConfirm) {
        errors.password_confirm = "As senhas não coincidem.";
    }
    return errors;
}

function registerErrorMessage(error) {
    if (!(error instanceof ApiError)) {
        return "Ocorreu um erro inesperado. Tente novamente.";
    }
    if (error.status === 0) {
        return "Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.";
    }
    if (error.status === 400 || error.status === 422 || error.status === 403) {
        // 400: usuário ou email já em uso; 422: regra de campo; 403: cadastro fechado até o lançamento.
        // Em todos o backend manda a mensagem pronta.
        return error.message;
    }
    return "Não foi possível criar a conta agora. Tente novamente.";
}

// Campo corrigido: a mensagem some assim que a pessoa volta a digitar nele.
Array.from(registerForm.elements).forEach((input) => {
    if (input.name) {
        input.addEventListener("input", () => clearFieldError(input.name));
    }
});

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideRegisterMessages();

    const fields = {
        username: registerForm.username.value.trim().toLowerCase(),
        email: registerForm.email.value.trim(),
        password: registerForm.password.value,
        passwordConfirm: registerForm.password_confirm.value,
    };

    ["username", "email", "password", "password_confirm"].forEach(clearFieldError);
    const fieldErrors = validateRegisterForm(fields);
    const invalidNames = Object.keys(fieldErrors);
    if (invalidNames.length > 0) {
        invalidNames.forEach((name) => showFieldError(name, fieldErrors[name]));
        registerForm.elements[invalidNames[0]].focus();
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

launchPromise.then((launch) => {
    if (!launch || launch.open) {
        return;
    }
    registerForm.hidden = true;
    document.getElementById("register-launch-date").textContent = formatLaunchDate(new Date(launch.launch_at));
    document.getElementById("register-closed").hidden = false;
});
