/**
 * Perfil técnico (paginas/perfil/index.html): cria ou edita o perfil do usuário autenticado.
 *
 * Depende de session.js (hasSession, getCurrentUser, renderHeaderUser) e de
 * api.js (apiFetch, ApiError). 401 já é tratado por apiFetch (logout + login).
 *
 * - GET /technologies monta as duas grades de tecnologias;
 * - GET /me/profile: 200 → modo edição (PUT); 404 → modo criação (POST);
 * - a mesma tecnologia nunca fica marcada em "domino" e "estudando" ao mesmo tempo.
 */

const GITHUB_USERNAME_PATTERN = /^[A-Za-z0-9-]+$/;
const TECHNOLOGY_KINDS = ["mastered", "learning"];

const profileForm = document.getElementById("profile-form");
const profileLoading = document.getElementById("profile-loading");
const profileLoadError = document.getElementById("profile-load-error");
const profileLoadErrorMessage = document.getElementById("profile-load-error-message");
const profileRetry = document.getElementById("profile-retry");
const profileError = document.getElementById("profile-error");
const profileSuccess = document.getElementById("profile-success");
const profileSubmit = document.getElementById("profile-submit");
const profileMode = document.getElementById("profile-mode");
const profileFields = {
    fullName: document.getElementById("full_name"),
    level: document.getElementById("level"),
    bio: document.getElementById("bio"),
    interests: document.getElementById("interests"),
    githubUsername: document.getElementById("github_username"),
};
const technologyGrids = {
    mastered: document.getElementById("mastered-technologies"),
    learning: document.getElementById("learning-technologies"),
};

let currentUser = null;
let hasProfile = false;

function showProfileError(message) {
    profileSuccess.hidden = true;
    profileError.textContent = message;
    profileError.hidden = false;
}

function showProfileSuccess(message) {
    profileError.hidden = true;
    profileSuccess.textContent = message;
    profileSuccess.hidden = false;
}

function hideProfileMessages() {
    profileError.hidden = true;
    profileSuccess.hidden = true;
}

function showLoadError(message) {
    profileLoading.hidden = true;
    profileForm.hidden = true;
    profileLoadErrorMessage.textContent = message;
    profileLoadError.hidden = false;
}

/** Criação (sem perfil → POST) ou edição (com perfil → PUT). */
function setMode(editing) {
    hasProfile = editing;
    profileSubmit.textContent = editing ? "Salvar alterações" : "Criar perfil";
    profileMode.textContent = editing ? "Editando perfil" : "Novo perfil";
    profileMode.classList.toggle("match", !editing);
}

/** Uma grade de checkboxes por categoria, com o catálogo vindo da API. */
function renderTechnologies(catalog) {
    TECHNOLOGY_KINDS.forEach((kind) => {
        const grid = technologyGrids[kind];
        grid.replaceChildren();

        if (catalog.length === 0) {
            const empty = document.createElement("p");
            empty.className = "section-hint";
            empty.textContent = "Nenhuma tecnologia cadastrada no catálogo.";
            grid.append(empty);
            return;
        }

        catalog.forEach((technology) => {
            const label = document.createElement("label");
            label.className = "tech-option";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.name = `${kind}_technology_ids`;
            input.value = String(technology.id);

            const name = document.createElement("span");
            name.textContent = technology.name;

            label.append(input, name);
            grid.append(label);
        });
    });
}

function getTechnologyInputs(kind) {
    return Array.from(technologyGrids[kind].querySelectorAll("input[type='checkbox']"));
}

function getSelectedTechnologyIds(kind) {
    return getTechnologyInputs(kind)
        .filter((input) => input.checked)
        .map((input) => Number(input.value));
}

function setSelectedTechnologies(kind, technologies) {
    const ids = new Set(technologies.map((technology) => String(technology.id)));
    getTechnologyInputs(kind).forEach((input) => {
        input.checked = ids.has(input.value);
    });
}

/** Ao marcar uma tecnologia em uma categoria, desmarca a mesma na outra. */
function handleTechnologyChange(event) {
    const input = event.target;
    if (!input.checked) {
        return;
    }
    const otherKind = event.currentTarget === technologyGrids.mastered ? "learning" : "mastered";
    getTechnologyInputs(otherKind).forEach((other) => {
        if (other.value === input.value) {
            other.checked = false;
        }
    });
}

function fillForm(profile) {
    profileFields.fullName.value = profile.full_name || "";
    profileFields.level.value = profile.level || "";
    profileFields.bio.value = profile.bio || "";
    profileFields.interests.value = profile.interests || "";
    profileFields.githubUsername.value = profile.github_username || "";
    setSelectedTechnologies("mastered", profile.mastered || []);
    setSelectedTechnologies("learning", profile.learning || []);
}

function buildProfilePayload() {
    return {
        full_name: profileFields.fullName.value.trim(),
        level: profileFields.level.value,
        bio: profileFields.bio.value.trim(),
        interests: profileFields.interests.value.trim(),
        github_username: profileFields.githubUsername.value.trim(),
        mastered_technology_ids: getSelectedTechnologyIds("mastered"),
        learning_technology_ids: getSelectedTechnologyIds("learning"),
    };
}

/** Retorna a mensagem do primeiro problema encontrado ou null se estiver tudo certo. */
function validateProfilePayload(payload) {
    if (!payload.full_name) {
        return "Informe seu nome completo.";
    }
    if (payload.full_name.length > 120) {
        return "O nome completo pode ter no máximo 120 caracteres.";
    }
    if (!payload.level) {
        return "Selecione seu nível.";
    }
    if (payload.github_username.length > 39) {
        return "O usuário do GitHub pode ter no máximo 39 caracteres.";
    }
    if (payload.github_username && !GITHUB_USERNAME_PATTERN.test(payload.github_username)) {
        return "Informe apenas o usuário do GitHub (letras, números e hífen), sem link ou @.";
    }
    return null;
}

function profileErrorMessage(error) {
    if (!(error instanceof ApiError)) {
        return "Ocorreu um erro inesperado. Tente novamente.";
    }
    if (error.status === 0) {
        return "Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.";
    }
    if (error.status === 422) {
        return `Dados inválidos: ${error.message.replace(/Value error, /g, "")}`;
    }
    return "Não foi possível salvar o perfil agora. Tente novamente.";
}

/** Nome do header passa a refletir o full_name salvo (GET /me fica em cache no session.js). */
function updateHeaderName(profile) {
    if (!currentUser) {
        return;
    }
    currentUser = { ...currentUser, profile: { ...(currentUser.profile || {}), full_name: profile.full_name } };
    renderHeaderUser(currentUser);
}

/** GET /me/profile: devolve o perfil ou null (404 = ainda não criado). */
async function fetchProfile() {
    try {
        return await apiFetch("/me/profile", { auth: true });
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            return null;
        }
        throw error;
    }
}

async function loadProfilePage() {
    try {
        const [user, catalog] = await Promise.all([getCurrentUser(), apiFetch("/technologies")]);
        currentUser = user;
        renderTechnologies(catalog);

        const profile = await fetchProfile();
        if (profile) {
            fillForm(profile);
        }
        setMode(profile !== null);

        profileLoading.hidden = true;
        profileForm.hidden = false;
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return; // apiFetch já encerrou a sessão e redirecionou ao login
        }
        if (error instanceof ApiError && error.status === 0) {
            showLoadError("Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.");
        } else {
            showLoadError("Não foi possível carregar seu perfil agora. Tente novamente.");
        }
    }
}

/** 409 no POST: o perfil já existe (outra aba, por exemplo). Carrega o salvo e passa a editar. */
async function recoverExistingProfile() {
    try {
        const profile = await fetchProfile();
        if (profile) {
            fillForm(profile);
            setMode(true);
            showProfileError("Você já possui um perfil. Carregamos os dados salvos; revise e clique em \"Salvar alterações\".");
            return;
        }
        setMode(false);
        showProfileError("Não foi possível criar o perfil agora. Tente novamente.");
    } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
            showProfileError(profileErrorMessage(error));
        }
    }
}

async function handleProfileSubmit(event) {
    event.preventDefault();
    hideProfileMessages();

    const payload = buildProfilePayload();
    const validationError = validateProfilePayload(payload);
    if (validationError) {
        showProfileError(validationError);
        return;
    }

    const creating = !hasProfile;
    profileSubmit.disabled = true;
    profileSubmit.textContent = "Salvando...";

    try {
        const profile = await apiFetch("/me/profile", {
            method: creating ? "POST" : "PUT",
            body: payload,
            auth: true,
        });
        fillForm(profile);
        setMode(true);
        updateHeaderName(profile);
        showProfileSuccess(creating ? "Perfil criado com sucesso!" : "Alterações salvas com sucesso!");
    } catch (error) {
        setMode(hasProfile);
        if (error instanceof ApiError && error.status === 401) {
            return; // apiFetch já encerrou a sessão e redirecionou ao login
        }
        if (error instanceof ApiError && error.status === 409) {
            await recoverExistingProfile();
        } else if (error instanceof ApiError && error.status === 404) {
            setMode(false);
            showProfileError("Seu perfil não foi encontrado. Clique em \"Criar perfil\" para cadastrá-lo novamente.");
        } else {
            showProfileError(profileErrorMessage(error));
        }
    } finally {
        profileSubmit.disabled = false;
    }
}

if (hasSession) {
    TECHNOLOGY_KINDS.forEach((kind) => {
        technologyGrids[kind].addEventListener("change", handleTechnologyChange);
    });
    profileForm.addEventListener("submit", handleProfileSubmit);
    // getCurrentUser() guarda a promessa da primeira tentativa; recarregar refaz tudo do zero.
    profileRetry.addEventListener("click", () => window.location.reload());
    loadProfilePage();
}
