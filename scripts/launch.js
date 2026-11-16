/**
 * Trava de lançamento no front. A regra vale no backend (LAUNCH_AT): antes da data,
 * POST /register responde 403 e só a equipe consegue entrar.
 *
 * - `launchPromise`: {launch_at, open} de GET /launch, ou null com a API fora do ar
 *   (nesse caso os links ficam como estão e o backend continua barrando);
 * - antes do lançamento, links [data-signup-link] levam ao pré-cadastro da landing
 *   e passam a exibir o texto do atributo.
 *
 * Carregar depois de api.js e antes dos scripts que usam launchPromise.
 */

const PRE_SIGNUP_PAGE = "../inicio/index.html#pre-cadastro";

/** "01/12/2026 às 19:00", no fuso de Brasília. */
function formatLaunchDate(date) {
    const options = { timeZone: "America/Sao_Paulo" };
    const day = date.toLocaleDateString("pt-BR", options);
    const time = date.toLocaleTimeString("pt-BR", { ...options, hour: "2-digit", minute: "2-digit" });
    return `${day} às ${time}`;
}

async function loadLaunch() {
    try {
        return await apiFetch("/launch");
    } catch (error) {
        console.error("Não foi possível carregar a data de lançamento:", error.message);
        return null;
    }
}

const launchPromise = loadLaunch();

launchPromise.then((launch) => {
    if (!launch || launch.open) {
        return;
    }
    document.querySelectorAll("[data-signup-link]").forEach((link) => {
        link.href = PRE_SIGNUP_PAGE;
        link.textContent = link.dataset.signupLink;
    });
});
