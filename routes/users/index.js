"use strict";

const {
  getUserMeSchema,
  updateUserMeSchema,
  deleteUserMeSchema,
} = require("../../schemas/userSchemas");
const UserService = require("../../services/userService");

module.exports = async function (fastify, opts) {
  // Hook de autenticação para todas as rotas neste plugin
  // Certifique-se de que fastify.authenticate está definido (ex: por um plugin authHook.js)
  if (!fastify.authenticate) {
    fastify.log.error(
      "Hook fastify.authenticate não está definido! As rotas de /users/me não serão protegidas."
    );
    // Você pode querer lançar um erro aqui para impedir o boot se a autenticação for crítica.
    // throw new Error("fastify.authenticate is required for /users routes");
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
      // request.user é populado pelo hook fastify.authenticate
      if (!request.user || !request.user.userId) {
        // Esta verificação é uma segurança extra, o hook authenticate já deveria ter barrado
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
        reply.send(result); // O serviço envia { message: '...' }
      }
    }
  );
};
