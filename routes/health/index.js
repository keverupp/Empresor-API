// routes/health/index.js
"use strict";

module.exports = async function (fastify, opts) {
  fastify.get("/", async (request, reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Rota para testar a conexão com o banco via fastify.knex
  fastify.get("/db", async (request, reply) => {
    try {
      // Usando fastify.knex aqui
      const result = await fastify.knex.raw("SELECT version()"); // <<< MUDANÇA AQUI
      fastify.log.info(`Versão do PostgreSQL: ${result.rows[0].version}`);
      return { status: "ok", db_via_knex: "connected" }; // Mensagem atualizada
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return {
        status: "error",
        db_via_knex: "disconnected",
        message: error.message,
      }; // Mensagem atualizada
    }
  });
};
