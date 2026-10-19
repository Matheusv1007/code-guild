/**
 * Card "GitHub" da tela de perfil (paginas/perfil/index.html).
 *
 * Depende de api.js (apiFetch, ApiError). 401 já é tratado por apiFetch (logout + login).
 * perfil.js chama loadGithubSection() depois de carregar e depois de salvar o perfil.
 *
 * - GET /me/github: dados salvos no banco (não consulta o GitHub);
 * - POST /me/github/refresh: consulta o GitHub agora (botão "Buscar"/"Atualizar");
 *   o backend aceita no máximo uma atualização a cada 10 minutos (next_refresh_at);
 * - qualquer erro aqui fica só neste card: o formulário de perfil continua funcionando
 *   e os dados já exibidos permanecem na tela.
 */

const githubSection = document.getElementById("github-section");
const githubRefresh = document.getElementById("github-refresh");
const githubStatus = document.getElementById("github-status");
const githubError = document.getElementById("github-error");
const githubContent = document.getElementById("github-content");
const githubFields = {
    avatar: document.getElementById("github-avatar"),
    name: document.getElementById("github-name"),
    bio: document.getElementById("github-bio"),
    publicRepos: document.getElementById("github-public-repos"),
    followers: document.getElementById("github-followers"),
    following: document.getElementById("github-following"),
    languages: document.getElementById("github-languages"),
    repos: document.getElementById("github-repos"),
};

let githubRefreshTimer = null;
let githubRefreshing = false;

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" });

/** Só links do próprio GitHub entram em href/src (os dados vêm de fora). */
function safeGithubUrl(url, allowedOrigins = ["https://github.com"]) {
    try {
        const parsed = new URL(url);
        return allowedOrigins.includes(parsed.origin) ? parsed.href : null;
    } catch {
        return null;
    }
}

function showGithubError(message) {
    githubError.textContent = message;
    githubError.hidden = false;
}

function hideGithubError() {
    githubError.hidden = true;
}

function githubErrorMessage(error) {
    if (!(error instanceof ApiError)) {
        return "Ocorreu um erro inesperado. Tente novamente.";
    }
    if (error.status === 0) {
        return "Não foi possível conectar ao servidor. Verifique se a API está rodando e tente novamente.";
    }
    // 404 (usuário inexistente), 422 (sem username), 429 (intervalo) e 503 (GitHub fora do ar/limite)
    // já vêm com mensagem pronta do backend.
    if ([404, 422, 429, 503].includes(error.status)) {
        return `${error.message}.`;
    }
    return "Não foi possível consultar o GitHub agora. Tente novamente mais tarde.";
}

function renderGithubProfile(profile) {
    const avatarUrl = safeGithubUrl(profile.avatar_url, ["https://avatars.githubusercontent.com"]);
    githubFields.avatar.hidden = !avatarUrl;
    if (avatarUrl) {
        githubFields.avatar.src = avatarUrl;
    }

    githubFields.name.textContent = profile.name ? `${profile.name} (@${profile.login})` : `@${profile.login}`;
    const profileUrl = safeGithubUrl(profile.html_url);
    if (profileUrl) {
        githubFields.name.href = profileUrl;
    } else {
        githubFields.name.removeAttribute("href");
    }

    githubFields.bio.textContent = profile.bio || "";
    githubFields.bio.hidden = !profile.bio;
    githubFields.publicRepos.textContent = profile.public_repos;
    githubFields.followers.textContent = profile.followers;
    githubFields.following.textContent = profile.following;
}

function renderGithubLanguages(languages) {
    githubFields.languages.replaceChildren();
    if (languages.length === 0) {
        const empty = document.createElement("li");
        empty.className = "field-hint";
        empty.textContent = "Nenhuma linguagem identificada nos repositórios públicos.";
        githubFields.languages.append(empty);
        return;
    }

    languages.forEach((language) => {
        const item = document.createElement("li");
        item.className = "github-language";

        const header = document.createElement("div");
        header.className = "github-language-header";
        const name = document.createElement("span");
        name.textContent = language.name;
        const value = document.createElement("span");
        const repoLabel = language.repositories === 1 ? "repositório" : "repositórios";
        value.textContent = `${language.percentage.toLocaleString("pt-BR")}% · ${language.repositories} ${repoLabel}`;
        header.append(name, value);

        const bar = document.createElement("div");
        bar.className = "github-language-bar";
        const fill = document.createElement("span");
        fill.style.width = `${language.percentage}%`;
        bar.append(fill);

        item.append(header, bar);
        githubFields.languages.append(item);
    });
}

function renderGithubRepos(repositories) {
    githubFields.repos.replaceChildren();
    if (repositories.length === 0) {
        const empty = document.createElement("li");
        empty.className = "field-hint";
        empty.textContent = "Nenhum repositório público.";
        githubFields.repos.append(empty);
        return;
    }

    repositories.forEach((repo) => {
        const item = document.createElement("li");
        item.className = "github-repo";

        const name = document.createElement("a");
        name.className = "github-repo-name";
        name.textContent = repo.name;
        name.target = "_blank";
        name.rel = "noopener noreferrer";
        const repoUrl = safeGithubUrl(repo.html_url);
        if (repoUrl) {
            name.href = repoUrl;
        }
        item.append(name);

        if (repo.description) {
            const description = document.createElement("p");
            description.textContent = repo.description;
            item.append(description);
        }

        const meta = document.createElement("div");
        meta.className = "github-repo-meta";
        if (repo.language) {
            const language = document.createElement("span");
            language.className = "badge";
            language.textContent = repo.language;
            meta.append(language);
        }
        const counts = document.createElement("span");
        counts.textContent = `★ ${repo.stars} · Forks ${repo.forks}`;
        meta.append(counts);
        if (repo.updated_at) {
            const updated = document.createElement("span");
            updated.textContent = `Atualizado em ${dateFormat.format(new Date(repo.updated_at))}`;
            meta.append(updated);
        }
        item.append(meta);

        githubFields.repos.append(item);
    });
}

/** Botão "Buscar"/"Atualizar": bloqueado até next_refresh_at e liberado sozinho depois. */
function setRefreshButton(github) {
    clearTimeout(githubRefreshTimer);
    githubRefresh.hidden = !github.username;
    githubRefresh.textContent = github.data ? "Atualizar dados" : "Buscar dados do GitHub";

    const nextRefresh = github.next_refresh_at ? new Date(github.next_refresh_at) : null;
    const waitMs = nextRefresh ? nextRefresh.getTime() - Date.now() : 0;
    githubRefresh.disabled = githubRefreshing || waitMs > 0;
    githubRefresh.title = waitMs > 0 ? `Nova atualização disponível às ${timeFormat.format(nextRefresh)}` : "";
    if (waitMs > 0) {
        githubRefreshTimer = setTimeout(() => {
            githubRefresh.disabled = githubRefreshing;
            githubRefresh.title = "";
        }, waitMs);
    }
}

function renderGithub(github) {
    githubSection.hidden = false;
    setRefreshButton(github);

    if (!github.username) {
        githubContent.hidden = true;
        githubStatus.textContent =
            "Informe seu usuário do GitHub em \"Informações pessoais\" e salve o perfil para exibir seu perfil público, repositórios e linguagens.";
        return;
    }

    if (!github.data) {
        githubContent.hidden = true;
        githubStatus.textContent = `Os dados de @${github.username} ainda não foram buscados. Clique em "Buscar dados do GitHub".`;
        return;
    }

    renderGithubProfile(github.data.profile);
    renderGithubLanguages(github.data.languages);
    renderGithubRepos(github.data.repositories);
    githubContent.hidden = false;

    let status = `Dados públicos de @${github.data.profile.login}, atualizados em ${dateTimeFormat.format(new Date(github.updated_at))}.`;
    if (github.next_refresh_at) {
        status += ` Nova atualização disponível às ${timeFormat.format(new Date(github.next_refresh_at))}.`;
    }
    githubStatus.textContent = status;
}

/** Sem perfil criado ainda: o card só explica o que fazer. */
function renderGithubWithoutProfile() {
    githubSection.hidden = false;
    githubContent.hidden = true;
    githubRefresh.hidden = true;
    githubStatus.textContent =
        "Crie seu perfil informando seu usuário do GitHub para exibir seu perfil público, repositórios e linguagens.";
}

/** GET /me/github. Chamado por perfil.js; erros ficam restritos a este card. */
async function loadGithubSection() {
    hideGithubError();
    try {
        renderGithub(await apiFetch("/me/github", { auth: true }));
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            return; // apiFetch já encerrou a sessão e redirecionou ao login
        }
        if (error instanceof ApiError && error.status === 404) {
            renderGithubWithoutProfile();
            return;
        }
        githubSection.hidden = false;
        showGithubError(
            error instanceof ApiError && error.status === 0
                ? "Não foi possível conectar ao servidor para carregar os dados do GitHub."
                : "Não foi possível carregar os dados do GitHub agora."
        );
    }
}

/** POST /me/github/refresh. Em erro, os dados já exibidos continuam na tela. */
async function handleGithubRefresh() {
    hideGithubError();
    githubRefreshing = true;
    githubRefresh.disabled = true;
    const previousLabel = githubRefresh.textContent;
    githubRefresh.textContent = "Consultando o GitHub...";

    try {
        const github = await apiFetch("/me/github/refresh", { method: "POST", auth: true });
        githubRefreshing = false;
        renderGithub(github);
    } catch (error) {
        githubRefreshing = false;
        githubRefresh.textContent = previousLabel;
        githubRefresh.disabled = false;
        if (error instanceof ApiError && error.status === 401) {
            return;
        }
        showGithubError(githubErrorMessage(error));
        // 429: o intervalo ainda não passou; recarrega para bloquear o botão até a hora certa.
        if (error instanceof ApiError && error.status === 429) {
            await loadGithubSection(); // não lança: trata os próprios erros
            showGithubError(githubErrorMessage(error));
        }
    }
}

githubRefresh.addEventListener("click", handleGithubRefresh);
