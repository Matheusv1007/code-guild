/**
 * Contagem regressiva da landing (paginas/inicio) até o marco definido pelo grupo.
 *
 * Para trocar o marco, altere APENAS COUNTDOWN_TARGET (data e hora com fuso).
 * A data exibida na página e o cálculo vêm daqui.
 *
 * - atualiza a cada segundo, sempre a partir do relógio (Date.now()), sem acumular atraso;
 * - ao chegar a zero: para em 00, para o intervalo e mostra a mensagem de chegada
 *   ([data-countdown-finished]); quem abrir a página depois da data já vê esse estado;
 * - data inválida: esconde a seção e registra o erro no console.
 *
 * Carregar no fim do <body> de paginas/inicio/index.html.
 */

// Lançamento do MVP: 01/12/2026 às 19:00, horário de Brasília (-03:00).
const COUNTDOWN_TARGET = "2026-12-01T19:00:00-03:00";

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

/** "01/12/2026 às 19:00", no fuso de Brasília (o mesmo de COUNTDOWN_TARGET). */
function formatTargetDate(date) {
    const options = { timeZone: "America/Sao_Paulo" };
    const day = date.toLocaleDateString("pt-BR", options);
    const time = date.toLocaleTimeString("pt-BR", { ...options, hour: "2-digit", minute: "2-digit" });
    return `${day} às ${time}`;
}

function initCountdown() {
    const section = document.querySelector("[data-countdown]");
    if (!section) {
        return;
    }

    const target = new Date(COUNTDOWN_TARGET);
    if (Number.isNaN(target.getTime())) {
        console.error("COUNTDOWN_TARGET inválida:", COUNTDOWN_TARGET);
        section.hidden = true;
        return;
    }

    const units = {};
    section.querySelectorAll("[data-countdown-unit]").forEach((element) => {
        units[element.dataset.countdownUnit] = element;
    });
    const running = section.querySelector("[data-countdown-running]");
    const finished = section.querySelector("[data-countdown-finished]");

    const dateElement = section.querySelector("[data-countdown-date]");
    dateElement.textContent = formatTargetDate(target);
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
