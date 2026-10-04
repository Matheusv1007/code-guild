/**
 * Cliente HTTP base para a API CodeGuild (FastAPI).
 *
 * Backend padrão: http://127.0.0.1:8000
 * Frontend padrão: http://127.0.0.1:5500
 *
 * Depende de getToken() (scripts/auth.js) apenas quando a opção `auth` é usada.
 */

const API_URL = "http://127.0.0.1:8000";

class ApiError extends Error {
    constructor(status, message, data = null) {
        super(message);
        this.name = "ApiError";
        this.status = status; // 0 = falha de rede / API fora do ar
        this.data = data;
    }
}

/**
 * Converte o corpo de erro do FastAPI em uma mensagem legível.
 * - HTTPException: {"detail": "texto"}
 * - Validação (422): {"detail": [{"msg": "...", "loc": [...]}, ...]}
 */
function extractErrorMessage(data, response) {
    const detail = data && data.detail;
    if (typeof detail === "string") {
        return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
        return detail.map((item) => item.msg).join("; ");
    }
    return `Erro ${response.status} ao comunicar com a API`;
}

/**
 * Faz uma requisição à API e devolve o JSON da resposta.
 *
 * @param {string} path    Caminho do endpoint, ex.: "/login"
 * @param {object} options
 *   - method:  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" (padrão "GET")
 *   - body:    objeto que será enviado como JSON
 *   - auth:    true para enviar "Authorization: Bearer <token>"
 *   - headers: cabeçalhos extras
 * @throws {ApiError} em falha de rede ou status HTTP fora de 2xx
 */
async function apiFetch(path, { method = "GET", body, auth = false, headers = {} } = {}) {
    const requestHeaders = { Accept: "application/json", ...headers };

    if (body !== undefined) {
        requestHeaders["Content-Type"] = "application/json";
    }

    if (auth) {
        const token = getToken();
        if (!token) {
            throw new ApiError(401, "Usuário não autenticado");
        }
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    let response;
    try {
        response = await fetch(`${API_URL}${path}`, {
            method,
            headers: requestHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch (error) {
        throw new ApiError(0, `Não foi possível conectar à API em ${API_URL}. Verifique se o backend está rodando.`);
    }

    const data = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
        throw new ApiError(response.status, extractErrorMessage(data, response), data);
    }

    return data;
}
