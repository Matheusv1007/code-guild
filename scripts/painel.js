/**
 * Painel: saudação com o primeiro nome do usuário autenticado.
 * Depende de session.js (hasSession, getCurrentUser, getFirstName).
 * Cards, estatísticas e match continuam estáticos nesta etapa.
 */

if (hasSession) {
    getCurrentUser()
        .then((user) => {
            document.getElementById("welcome-title").textContent = `Olá, ${getFirstName(user)} 👋`;
        })
        .catch(() => {
            // Erro já registrado por session.js; a saudação genérica permanece.
        });
}
