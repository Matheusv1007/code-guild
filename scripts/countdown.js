/**
 * Contagem regressiva da landing (paginas/inicio) até o lançamento.
 *
 * A data vem de GET /launch (variável LAUNCH_AT do backend), a mesma que libera o cadastro.
 *
 * - atualiza a cada segundo, sempre a partir do relógio (Date.now()), sem acumular atraso;
 * - ao chegar a zero: para em 00, para o intervalo e mostra a mensagem de chegada
 *   ([data-countdown-finished]); quem abrir a página depois da data já vê esse estado;
 * - sem data (LAUNCH_AT não definida) ou API fora do ar: esconde a seção.
 *
 * Carregar no fim do <body> de paginas/inicio/index.html, depois de launch.js.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Divide os milissegundos restantes em dias, horas, minutos e segundos (nunca negativos). */
function splitRemaining(ms) {
    const remaining = Math.max(ms, 0);
    return {
        days: Math.floor(remaining / DAY),
        hours: Math.floor((remaining % DAY) / HOUR),
        minutes: Math.floor((remaining % HOUR) / MINUTE),
        seconds: Math.floor((remaining % MINUTE) / SECOND),
    };
}

function pad(value) {
    return String(value).padStart(2, "0");
}

async function initCountdown() {
    const section = document.querySelector("[data-countdown]");
    if (!section) {
        return;
    }

    const launch = await launchPromise;
    if (!launch || !launch.launch_at) {
        section.hidden = true;
        return;
    }
    const target = new Date(launch.launch_at);

    const units = {};
    section.querySelectorAll("[data-countdown-unit]").forEach((element) => {
        units[element.dataset.countdownUnit] = element;
    });
    const running = section.querySelector("[data-countdown-running]");
    const finished = section.querySelector("[data-countdown-finished]");

    const dateElement = section.querySelector("[data-countdown-date]");
    dateElement.textContent = formatLaunchDate(target);
    dateElement.setAttribute("datetime", target.toISOString());

    let intervalId = null;

    function render() {
        const remaining = target.getTime() - Date.now();
        const parts = splitRemaining(remaining);

        // Dias sem limite de dígitos (pode passar de 99); os demais sempre com dois.
        units.days.textContent = pad(parts.days);
        units.hours.textContent = pad(parts.hours);
        units.minutes.textContent = pad(parts.minutes);
        units.seconds.textContent = pad(parts.seconds);

        if (remaining <= 0) {
            clearInterval(intervalId);
            section.classList.add("is-finished");
            running.hidden = true;
            finished.hidden = false;
        }
    }

    render();
    if (!section.classList.contains("is-finished")) {
        intervalId = setInterval(render, SECOND);
    }
}

initCountdown();
