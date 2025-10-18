// plugins/authHook.js (ou hooks/authHook.js)
"use strict";

const fp = require("fastify-plugin");

async function authHookPlugin(fastify, opts) {
  let masterUser = null;

  fastify.decorate("authenticate", async function (request, reply) {
    const masterKey = request.headers['authorization'];
    if (masterKey && masterKey === `Bearer ${fastify.config.MASTER_KEY}`) {
      const companyId = request.headers['x-company-id'];
      if (!companyId) {
        return reply.code(400).send({
          statusCode: 400,
          error: "BAD_REQUEST",
          message: "Master key authentication requires a X-Company-ID header.",
        });
      }

      if (!masterUser) {
        masterUser = await fastify.knex('users').where({ email: fastify.config.MASTER_USER_EMAIL }).first();
      }

      if (masterUser) {
        request.user = {
          userId: masterUser.id,
          email: masterUser.email,
          companyId: parseInt(companyId, 10),
          isMaster: true,
        };
        return;
      } else {
        // Master key is correct, but the master user is not in the DB
        return reply.code(401).send({
          statusCode: 401,
          error: "UNAUTHORIZED",
          message: "Master key is valid, but the master user is not configured in the database. Please run the database seeds.",
        });
      }
    }

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
