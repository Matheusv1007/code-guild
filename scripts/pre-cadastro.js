/**
 * Pré-cadastro da landing (seção #pre-cadastro de paginas/inicio/index.html).
 *
 * Envia nome, e-mail, curso/período e áreas de interesse para POST /leads.
 * A rota é pública: não envia token e funciona igual para visitante e para usuário logado.
 *
 * O backend só exige que os quatro campos sejam texto: campos vazios, só com espaços e
 * e-mail inválido são barrados aqui. O e-mail vai em minúsculas porque a checagem de
 * duplicado do backend diferencia maiúsculas de minúsculas.
 *
 * Depende de api.js (apiFetch, ApiError) carregado antes.
 */

// Mesmo padrão de scripts/cadastro.js (nome próprio: os scripts compartilham o escopo global).
const LEAD_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LEAD_FIELDS = ["name", "email", "course_period", "areas_of_interest"];
const LEAD_SUCCESS_MESSAGE = "Pré-cadastro realizado! Avisaremos você no lançamento.";

const leadForm = document.querySelector(".lead-form");
const leadError = document.getElementById("lead-error");
const leadSuccess = document.getElementById("lead-success");
const leadButton = leadForm.querySelector("button[type='submit']");
const leadButtonLabel = leadButton.textContent;

function showLeadError(message) {
    leadSuccess.hidden = true;
    leadError.textContent = message;
    leadError.hidden = false;
}

function showLeadSuccess(message) {
    leadError.hidden = true;
    leadSuccess.textContent = message;
    leadSuccess.hidden = false;
}

function hideLeadMessages() {
    leadError.hidden = true;
    leadSuccess.hidden = true;
}

/** Valores já normalizados: trim() em todos e e-mail em minúsculas. */
function readLeadFields() {
    const fields = {};
    LEAD_FIELDS.forEach((name) => {
        fields[name] = leadForm.elements[name].value.trim();
    });
    fields.email = fields.email.toLowerCase();
    return fields;
}

/** Mensagem do problema de um campo ou null se ele estiver válido. */
function leadFieldProblem(name, value) {
    if (!value) {
        return "Preencha todos os campos.";
    }
    if (name === "email" && !LEAD_EMAIL_PATTERN.test(value)) {
        return "Informe um e-mail válido.";
    }
    return null;
}

/** Marca com aria-invalid só os campos listados e foca o primeiro deles. */
function markLeadInvalid(invalidNames) {
    LEAD_FIELDS.forEach((name) => {
        const input = leadForm.elements[name];
        if (invalidNames.includes(name)) {
            input.setAttribute("aria-invalid", "true");
        } else {
            input.removeAttribute("aria-invalid");
        }
    });
    if (invalidNames.length > 0) {
        leadForm.elements[invalidNames[0]].focus();
    }
}

function leadErrorMessage(error) {
    if (!(error instanceof ApiError)) {
        return "Não foi possível concluir o pré-cadastro agora. Tente novamente.";
    }
    if (error.status === 0) {
        return "Não foi possível conectar ao servidor. Tente novamente mais tarde.";
    }
    if (error.status === 400) {
        // Única regra de negócio de POST /leads: e-mail único.
        return "Este e-mail já está na lista de pré-cadastro.";
    }
    if (error.status === 422) {
        return "Dados inválidos. Revise os campos.";
    }
    return "Não foi possível concluir o pré-cadastro agora. Tente novamente.";
}

// Campo corrigido: tira o aria-invalid assim que o valor passa a ser válido.
LEAD_FIELDS.forEach((name) => {
    const input = leadForm.elements[name];
    input.addEventListener("input", () => {
        if (input.getAttribute("aria-invalid") !== "true") {
            return;
        }
        const value = name === "email" ? input.value.trim().toLowerCase() : input.value.trim();
        if (!leadFieldProblem(name, value)) {
            input.removeAttribute("aria-invalid");
        }
    });
});

leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    // Envio em andamento: ignora novos submits (ex.: Enter repetido).
    if (leadButton.disabled) {
        return;
    }
    hideLeadMessages();

    const fields = readLeadFields();
    const invalidNames = LEAD_FIELDS.filter((name) => leadFieldProblem(name, fields[name]));
    markLeadInvalid(invalidNames);
    if (invalidNames.length > 0) {
        showLeadError(leadFieldProblem(invalidNames[0], fields[invalidNames[0]]));
        return;
    }

    leadButton.disabled = true;
    leadButton.textContent = "Enviando...";

    try {
        await apiFetch("/leads", { method: "POST", body: fields });
        leadForm.reset();
        showLeadSuccess(LEAD_SUCCESS_MESSAGE);
    } catch (error) {
        showLeadError(leadErrorMessage(error));
        if (error instanceof ApiError && error.status === 400) {
            markLeadInvalid(["email"]);
        }
    } finally {
        leadButton.disabled = false;
        leadButton.textContent = leadButtonLabel;
    }
});
