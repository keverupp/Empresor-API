// plugins/authPlanHook.js
"use strict";

const fp = require("fastify-plugin");
const PermissionService = require("../services/permissionService");

async function authPlanHook(fastify, opts) {
  // Este hook será executado após o hook de autenticação principal.
  // Certifique-se de que ele seja registrado depois do seu plugin de autenticação.
  fastify.addHook("preHandler", async (request, reply) => {
    // Verifica se o usuário já foi autenticado e anexado ao request
    if (request.user && request.user.userId && !request.user.plan) {
      try {
        // Usa o novo serviço para buscar os detalhes do plano
        const plan = await PermissionService.getUserPlan(
          fastify,
          request.user.userId
        );

        // Anexa o plano ao objeto do usuário para uso posterior na requisição
        request.user.plan = plan;
      } catch (error) {
        fastify.log.error(
          error,
          `Falha ao buscar plano para o usuário ${request.user.userId} no authPlanHook.`
        );
        // Decide se deve lançar um erro ou continuar sem informações do plano
        // Por segurança, é melhor lançar um erro se o plano for crítico.
        throw new Error("Não foi possível verificar as permissões do usuário.");
      }
    }
  });
}

module.exports = fp(authPlanHook, {
  name: "authPlanHook",
  dependencies: ["auth-hook"],
});
