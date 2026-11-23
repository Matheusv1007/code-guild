/**
 * Perfil público (paginas/perfil-publico/index.html?id=N), só leitura.
 *
 * GET /users/{id}/profile é público (sem e-mail); o header segue a sessão (public-header.js).
 * O card do GitHub é o mesmo da tela de perfil (github.js), sem o botão de atualizar: mostra só o que
 * já está salvo.
 * Depende de api.js, user-header.js (getInitials), public-header.js (publicUserPromise),
 * projects.js (getIdFromUrl, createElement, createTechnologyTags, LEVEL_LABELS) e github.js (renderGithub).
 */

const profileUserId = getIdFromUrl();

const profileLoading = document.getElementById("profile-loading");
const profileError = document.getElementById("profile-error");
const profileErrorMessage = document.getElementById("profile-error-message");
const profileView = document.getElementById("profile-view");
const publicProfileFields = {
    initials: document.getElementById("profile-initials"),
    name: document.getElementById("profile-name"),
    meta: document.getElementById("profile-meta"),
    edit: document.getElementById("profile-edit"),
    bio: document.getElementById("profile-bio"),
    interests: document.getElementById("profile-interests"),
    mastered: document.getElementById("profile-mastered"),
    learning: document.getElementById("profile-learning"),
};

function showProfileError(message) {
    profileLoading.hidden = true;
    profileView.hidden = true;
    document.getElementById("github-section").hidden = true;
    profileErrorMessage.textContent = message;
    profileError.hidden = false;
}

/** Texto da pessoa (bio, interesses) ou um aviso discreto quando ela não preencheu. */
function setProfileText(element, text) {
    element.textContent = text || "Não informado.";
    element.classList.toggle("public-empty", !text);
}

function setProfileTechnologies(container, technologies) {
    if (technologies.length === 0) {
        container.replaceChildren(createElement("p", "public-empty", "Nenhuma tecnologia informada."));
        return;
    }
    container.replaceChildren(createTechnologyTags(technologies));
}

function renderPublicProfile(profile, viewer) {
    document.title = `${profile.full_name} - CodeGuild`;
    publicProfileFields.initials.textContent = getInitials(profile.full_name);
    publicProfileFields.name.textContent = profile.full_name;
    publicProfileFields.meta.textContent = `@${profile.username} · ${LEVEL_LABELS[profile.level] || profile.level}`;
    publicProfileFields.edit.hidden = viewer === null || viewer.id !== profile.user_id;
    setProfileText(publicProfileFields.bio, profile.bio);
    setProfileText(publicProfileFields.interests, profile.interests);
    setProfileTechnologies(publicProfileFields.mastered, profile.mastered);
    setProfileTechnologies(publicProfileFields.learning, profile.learning);

    profileLoading.hidden = true;
    profileError.hidden = true;
    profileView.hidden = false;
    renderGithub(profile.github);
}

/** "Voltar" retorna à página anterior do próprio site (detalhes do projeto, candidatos...); sem ela, ao Explorar. */
function bindBackLink() {
    const backLink = document.getElementById("back-link");
    if (document.referrer && new URL(document.referrer).origin === window.location.origin) {
        backLink.addEventListener("click", (event) => {
            event.preventDefault();
            window.history.back();
        });
    }
}

async function loadPublicProfile() {
    bindBackLink();
    if (profileUserId === null) {
        showProfileError("Perfil não encontrado.");
        return;
    }
    try {
        const [profile, viewer] = await Promise.all([apiFetch(`/users/${profileUserId}/profile`), publicUserPromise]);
        renderPublicProfile(profile, viewer);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            showProfileError("Perfil não encontrado. A pessoa pode não ter criado o perfil ainda ou o link está incorreto.");
        } else if (error instanceof ApiError && error.status === 0) {
            showProfileError("Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.");
        } else {
            showProfileError("Não foi possível carregar o perfil agora. Tente novamente.");
        }
    }
}

loadPublicProfile();
