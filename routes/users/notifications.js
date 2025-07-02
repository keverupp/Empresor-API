// routes/users/notifications.js
"use strict";

const {
  listUserNotificationsSchema,
  getNotificationsSummarySchema,
  getNotificationByIdSchema,
  markNotificationsAsReadSchema,
  markAllNotificationsAsReadSchema,
} = require("../../schemas/notificationSchemas");

module.exports = async function (fastify, opts) {
  // Hook de autenticação para todas as rotas de notificações
  const preHandler = fastify.authenticate ? [fastify.authenticate] : [];

  if (!fastify.authenticate) {
    fastify.log.error(
      "Hook fastify.authenticate não está definido! As rotas de notificações não serão protegidas."
    );
  }

  // Wrapper para tratamento de erro do serviço
  async function handleServiceCall(reply, serviceFn, ...args) {
    try {
      const result = await serviceFn(fastify, ...args);
      return result;
    } catch (error) {
      fastify.log.error(
        error,
        `[NotificationRoutes] Erro no serviço NotificationService.${serviceFn.name}`
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

  // Verificação de usuário autenticado
  function validateAuthenticatedUser(request, reply) {
    if (!request.user || !request.user.userId) {
      reply.code(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Usuário não autenticado.",
      });
      return false;
    }
    return true;
  }

  // GET /api/users/me/notifications
  fastify.get(
    "/me/notifications",
    { schema: listUserNotificationsSchema, preHandler },
    async (request, reply) => {
      if (!validateAuthenticatedUser(request, reply)) return;

      const { status, type, priority, limit, offset } = request.query;

      const filters = { status, type, priority };
      const pagination = { limit, offset };

      const result = await handleServiceCall(
        reply,
        fastify.services.notification.getUserNotifications,
        request.user.userId,
        filters,
        pagination
      );

      if (result) {
        reply.send(result);
      }
    }
  );

  // GET /api/users/me/notifications/summary
  fastify.get(
    "/me/notifications/summary",
    { schema: getNotificationsSummarySchema, preHandler },
    async (request, reply) => {
      if (!validateAuthenticatedUser(request, reply)) return;

      const summary = await handleServiceCall(
        reply,
        fastify.services.notification.getNotificationsSummary,
        request.user.userId
      );

      if (summary) {
        reply.send(summary);
      }
    }
  );

  // GET /api/users/me/notifications/:notificationId
  fastify.get(
    "/me/notifications/:notificationId",
    { schema: getNotificationByIdSchema, preHandler },
    async (request, reply) => {
      if (!validateAuthenticatedUser(request, reply)) return;

      const notification = await handleServiceCall(
        reply,
        fastify.services.notification.getNotificationById,
        request.user.userId,
        request.params.notificationId
      );

      if (notification) {
        reply.send(notification);
      }
    }
  );

  // POST /api/users/me/notifications/mark-read
  fastify.post(
    "/me/notifications/mark-read",
    { schema: markNotificationsAsReadSchema, preHandler },
    async (request, reply) => {
      if (!validateAuthenticatedUser(request, reply)) return;

      const { notification_ids } = request.body;

      const result = await handleServiceCall(
        reply,
        fastify.services.notification.markNotificationsAsRead,
        request.user.userId,
        notification_ids
      );

      if (result) {
        reply.send(result);
      }
    }
  );

  // POST /api/users/me/notifications/mark-all-read
  fastify.post(
    "/me/notifications/mark-all-read",
    { schema: markAllNotificationsAsReadSchema, preHandler },
    async (request, reply) => {
      if (!validateAuthenticatedUser(request, reply)) return;

      const result = await handleServiceCall(
        reply,
        fastify.services.notification.markAllNotificationsAsRead,
        request.user.userId
      );

      if (result) {
        reply.send(result);
      }
    }
  );
};
