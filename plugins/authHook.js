// plugins/authHook.js (ou hooks/authHook.js)
"use strict";

const fp = require("fastify-plugin");

async function authHookPlugin(fastify, opts) {
  fastify.decorate("authenticate", async function (request, reply) {
    try {
      // Esta função é fornecida pelo plugin @fastify/jwt
      // Ela verifica o token no cabeçalho 'Authorization: Bearer <token>'
      // e, se válido, anexa o payload decodificado a request.user
      await request.jwtVerify();
    } catch (err) {
      fastify.log.warn(
        { err, reqId: request.id },
        "Falha na autenticação JWT no hook."
      );
      // Se o token for inválido ou ausente, envia uma resposta 401 Unauthorized
      reply.code(401).send({
        statusCode: 401,
        error: "UNAUTHORIZED",
        message: "Token de autenticação inválido, expirado ou ausente.",
      });
    }
  });
  // Adicione um log para confirmar o carregamento
  fastify.log.info(
    "[Plugin: authHook] Decorator fastify.authenticate carregado e pronto para uso."
  );
}

module.exports = fp(authHookPlugin, {
  name: "auth-hook",
  dependencies: ["@fastify/jwt"], // Garante que @fastify/jwt foi carregado antes
});
