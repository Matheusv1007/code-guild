/**
 * Painel: saudação com o primeiro nome do usuário autenticado e, se ele ainda
 * não tem perfil técnico (GET /me com profile: null), aviso para completá-lo.
 * Depende de session.js (hasSession, getCurrentUser, getFirstName).
 * Cards, estatísticas e match continuam estáticos nesta etapa.
 */

if (hasSession) {
    getCurrentUser()
        .then((user) => {
            document.getElementById("welcome-title").textContent = `Olá, ${getFirstName(user)} 👋`;
            document.getElementById("profile-reminder").hidden = user.profile !== null;
        })
        .catch(() => {
            // Erro já registrado por session.js; a saudação genérica permanece.
        });
}
