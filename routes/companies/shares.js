"use strict";

// Importa os schemas de rota completos do arquivo correspondente
const {
  createShareSchema,
  listSharesSchema,
  deleteShareSchema,
} = require("../../schemas/companyShareSchemas");

module.exports = async function (fastify, opts) {
  const { services, knex } = fastify;

  // Hook de pré-validação que será usado por todas as rotas neste módulo.
  // Garante que apenas o proprietário da empresa pode gerenciar os compartilhamentos.
  const sharesPreHandler = {
    preHandler: [
      fastify.authenticate,
      async function (request, reply) {
        // As rotas de share usam 'companyId' como parâmetro
        const { companyId } = request.params;
        try {
          // Garante que o usuário autenticado é o proprietário da empresa
          await services.company.getCompanyById(
            fastify,
            request.user.userId,
            companyId
          );
        } catch (error) {
          reply.code(error.statusCode || 403).send({
            statusCode: error.statusCode || 403,
            error: error.code || "Forbidden",
            message: error.message || "Acesso negado.",
          });
        }
      },
    ],
  };

  // Rota para compartilhar uma empresa com outro usuário
  fastify.post(
    "/:companyId/shares",
    { schema: createShareSchema, ...sharesPreHandler },
    async (request, reply) => {
      const { companyId } = request.params;
      const { email, permissions } = request.body; // Ajustado para usar 'permissions'
      const owner = await knex("users")
        .where({ id: request.user.userId })
        .first();

      try {
        const newShare = await services.companyShare.createShare(
          fastify,
          owner,
          companyId,
          email,
          permissions // Passando o objeto de permissões
        );
        reply.code(201).send(newShare);
      } catch (error) {
        reply.code(error.statusCode || 500).send({
          statusCode: error.statusCode || 500,
          error: error.code || "InternalServerError",
          message: error.message,
        });
      }
    }
  );

  // Rota para listar com quem uma empresa está compartilhada
  fastify.get(
    "/:companyId/shares",
    { schema: listSharesSchema, ...sharesPreHandler },
    async (request, reply) => {
      const { companyId } = request.params;
      const shares = await services.companyShare.listShares(fastify, companyId);
      reply.send(shares);
    }
  );

  // Rota para remover o compartilhamento com um usuário
  fastify.delete(
    "/:companyId/shares/:userId",
    { schema: deleteShareSchema, ...sharesPreHandler },
    async (request, reply) => {
      const { companyId, userId } = request.params;
      try {
        const result = await services.companyShare.deleteShare(
          fastify,
          companyId,
          userId
        );
        reply.send(result);
      } catch (error) {
        reply.code(error.statusCode || 500).send({
          statusCode: error.statusCode || 500,
          error: error.code || "InternalServerError",
          message: error.message,
        });
      }
    }
  );
};
