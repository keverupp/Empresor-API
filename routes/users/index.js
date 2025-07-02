// routes/users/index.js (ATUALIZADO)
"use strict";

const {
  getUserMeSchema,
  updateUserMeSchema,
  deleteUserMeSchema,
} = require("../../schemas/userSchemas");
const UserService = require("../../services/userService");

module.exports = async function (fastify, opts) {
  // Hook de autenticação para todas as rotas neste plugin
  if (!fastify.authenticate) {
    fastify.log.error(
      "Hook fastify.authenticate não está definido! As rotas de /users/me não serão protegidas."
    );
  }
  const preHandler = fastify.authenticate ? [fastify.authenticate] : [];

  // Wrapper para tratamento de erro do serviço (similar ao de authRoutes)
  async function handleServiceCall(reply, serviceFn, userId, payload) {
    try {
      const result = await serviceFn(fastify, userId, payload);
      return result;
    } catch (error) {
      fastify.log.error(
        error,
        `[UserRoutes] Erro no serviço UserService.${serviceFn.name}`
      );
      const statusCode = error.statusCode || 500;
      const message = error.message || "Ocorreu um erro inesperado.";
      const errorCode =
        error.code ||
        (statusCode === 500 ? "InternalServerError" : "BadRequest");
      reply.code(statusCode).send({ statusCode, error: errorCode, message });
      return null;
    }
  }

  // GET /api/users/me
  fastify.get(
    "/me",
    { schema: getUserMeSchema, preHandler },
    async (request, reply) => {
      if (!request.user || !request.user.userId) {
        return reply.code(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Usuário não autenticado.",
        });
      }
      const userProfile = await handleServiceCall(
        reply,
        UserService.getUserProfile,
        request.user.userId
      );
      if (userProfile) {
        reply.send(userProfile);
      }
    }
  );

  // PUT /api/users/me
  fastify.put(
    "/me",
    { schema: updateUserMeSchema, preHandler },
    async (request, reply) => {
      if (!request.user || !request.user.userId) {
        return reply.code(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Usuário não autenticado.",
        });
      }
      const updatedProfile = await handleServiceCall(
        reply,
        UserService.updateUserProfile,
        request.user.userId,
        request.body
      );
      if (updatedProfile) {
        reply.send(updatedProfile);
      }
    }
  );

  // DELETE /api/users/me
  fastify.delete(
    "/me",
    { schema: deleteUserMeSchema, preHandler },
    async (request, reply) => {
      if (!request.user || !request.user.userId) {
        return reply.code(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Usuário não autenticado.",
        });
      }
      const result = await handleServiceCall(
        reply,
        UserService.deleteUserAccount,
        request.user.userId
      );
      if (result) {
        reply.send(result);
      }
    }
  );

  // REGISTRAR AS ROTAS DE NOTIFICAÇÕES
  // As rotas de notificações serão acessíveis em:
  // GET /api/users/me/notifications
  // GET /api/users/me/notifications/summary
  // GET /api/users/me/notifications/:notificationId
  // POST /api/users/me/notifications/mark-read
  // POST /api/users/me/notifications/mark-all-read
  await fastify.register(require("./notifications"));
};
