// services/notificationService.js
"use strict";

/**
 * Busca notificações para um usuário específico com filtros e paginação
 * @param {object} fastify - Instância do Fastify
 * @param {number} userId - ID interno do usuário
 * @param {object} filters - Filtros opcionais
 * @param {object} pagination - Opções de paginação
 * @returns {Promise<object>} Lista de notificações e informações de paginação
 */
async function getUserNotifications(
  fastify,
  userId,
  filters = {},
  pagination = {}
) {
  const { knex, log } = fastify;
  const { status = "all", type, priority } = filters;
  const { limit = 20, offset = 0 } = pagination;

  try {
    // Query base para notificações que o usuário pode ver
    let notificationsQuery = knex("notifications as n")
      .leftJoin("notification_reads as nr", function () {
        this.on("n.id", "=", "nr.notification_id").andOn(
          "nr.user_id",
          "=",
          knex.raw("?", [userId])
        );
      })
      .where(function () {
        // Notificações globais OU específicas para o usuário
        this.whereNull("n.target_user_id").orWhere("n.target_user_id", userId);
      })
      .where("n.status", "active")
      .where(function () {
        // Notificações que não expiraram
        this.whereNull("n.expires_at").orWhere(
          "n.expires_at",
          ">",
          knex.fn.now()
        );
      })
      .select(
        "n.public_id as id",
        "n.type",
        "n.title",
        "n.content",
        "n.priority",
        "n.action_url",
        "n.metadata",
        "n.created_at",
        "n.expires_at",
        knex.raw(
          "CASE WHEN nr.id IS NOT NULL THEN true ELSE false END as is_read"
        ),
        "nr.read_at"
      );

    // Aplicar filtros
    if (status === "read") {
      notificationsQuery = notificationsQuery.whereNotNull("nr.id");
    } else if (status === "unread") {
      notificationsQuery = notificationsQuery.whereNull("nr.id");
    }

    if (type) {
      notificationsQuery = notificationsQuery.where("n.type", type);
    }

    if (priority) {
      notificationsQuery = notificationsQuery.where("n.priority", priority);
    }

    // Contar total para paginação
    const countQuery = notificationsQuery
      .clone()
      .clearSelect()
      .count("* as total");
    const [{ total }] = await countQuery;

    // Aplicar paginação e ordenação
    const notifications = await notificationsQuery
      .orderBy("n.priority", "desc") // Urgente primeiro
      .orderBy("n.created_at", "desc") // Mais recente primeiro
      .limit(limit)
      .offset(offset);

    // Processar metadata JSON
    const processedNotifications = notifications.map((notification) => ({
      ...notification,
      metadata: notification.metadata || {},
      is_read: Boolean(notification.is_read),
    }));

    return {
      notifications: processedNotifications,
      pagination: {
        total: parseInt(total),
        limit,
        offset,
        has_more: offset + limit < parseInt(total),
      },
    };
  } catch (error) {
    log.error(
      error,
      `[NotificationService] Erro ao buscar notificações para usuário ${userId}`
    );
    const serviceError = new Error("Erro ao buscar notificações.");
    serviceError.statusCode = 500;
    serviceError.code = "NOTIFICATION_FETCH_ERROR";
    throw serviceError;
  }
}

/**
 * Retorna um resumo das notificações do usuário
 * @param {object} fastify - Instância do Fastify
 * @param {number} userId - ID interno do usuário
 * @returns {Promise<object>} Resumo das notificações
 */
async function getNotificationsSummary(fastify, userId) {
  const { knex, log } = fastify;

  try {
    // Query para contadores de notificações
    const summary = await knex("notifications as n")
      .leftJoin("notification_reads as nr", function () {
        this.on("n.id", "=", "nr.notification_id").andOn(
          "nr.user_id",
          "=",
          knex.raw("?", [userId])
        );
      })
      .where(function () {
        this.whereNull("n.target_user_id").orWhere("n.target_user_id", userId);
      })
      .where("n.status", "active")
      .where(function () {
        this.whereNull("n.expires_at").orWhere(
          "n.expires_at",
          ">",
          knex.fn.now()
        );
      })
      .select(
        knex.raw("COUNT(*) as total_notifications"),
        knex.raw("COUNT(CASE WHEN nr.id IS NULL THEN 1 END) as unread_count"),
        knex.raw(
          `COUNT(CASE WHEN nr.id IS NULL AND n.priority = 'urgent' THEN 1 END) as urgent_unread_count`
        )
      )
      .first();

    return {
      total_notifications: parseInt(summary.total_notifications) || 0,
      unread_count: parseInt(summary.unread_count) || 0,
      urgent_unread_count: parseInt(summary.urgent_unread_count) || 0,
    };
  } catch (error) {
    log.error(
      error,
      `[NotificationService] Erro ao buscar resumo de notificações para usuário ${userId}`
    );
    const serviceError = new Error("Erro ao buscar resumo de notificações.");
    serviceError.statusCode = 500;
    serviceError.code = "NOTIFICATION_SUMMARY_ERROR";
    throw serviceError;
  }
}

/**
 * Busca uma notificação específica por ID
 * @param {object} fastify - Instância do Fastify
 * @param {number} userId - ID interno do usuário
 * @param {string} notificationPublicId - ID público da notificação
 * @returns {Promise<object>} Notificação encontrada
 */
async function getNotificationById(fastify, userId, notificationPublicId) {
  const { knex, log } = fastify;

  try {
    const notification = await knex("notifications as n")
      .leftJoin("notification_reads as nr", function () {
        this.on("n.id", "=", "nr.notification_id").andOn(
          "nr.user_id",
          "=",
          knex.raw("?", [userId])
        );
      })
      .where("n.public_id", notificationPublicId)
      .where(function () {
        this.whereNull("n.target_user_id").orWhere("n.target_user_id", userId);
      })
      .where("n.status", "active")
      .where(function () {
        this.whereNull("n.expires_at").orWhere(
          "n.expires_at",
          ">",
          knex.fn.now()
        );
      })
      .select(
        "n.public_id as id",
        "n.type",
        "n.title",
        "n.content",
        "n.priority",
        "n.action_url",
        "n.metadata",
        "n.created_at",
        "n.expires_at",
        knex.raw(
          "CASE WHEN nr.id IS NOT NULL THEN true ELSE false END as is_read"
        ),
        "nr.read_at"
      )
      .first();

    if (!notification) {
      const error = new Error("Notificação não encontrada.");
      error.statusCode = 404;
      error.code = "NOTIFICATION_NOT_FOUND";
      throw error;
    }

    return {
      ...notification,
      metadata: notification.metadata || {},
      is_read: Boolean(notification.is_read),
    };
  } catch (error) {
    if (error.statusCode === 404) {
      throw error;
    }

    log.error(
      error,
      `[NotificationService] Erro ao buscar notificação ${notificationPublicId} para usuário ${userId}`
    );
    const serviceError = new Error("Erro ao buscar notificação.");
    serviceError.statusCode = 500;
    serviceError.code = "NOTIFICATION_FETCH_BY_ID_ERROR";
    throw serviceError;
  }
}

/**
 * Marca notificações específicas como lidas
 * @param {object} fastify - Instância do Fastify
 * @param {number} userId - ID interno do usuário
 * @param {string[]} notificationPublicIds - Array de IDs públicos das notificações
 * @returns {Promise<object>} Resultado da operação
 */
async function markNotificationsAsRead(fastify, userId, notificationPublicIds) {
  const { knex, log } = fastify;

  try {
    // Buscar IDs internos das notificações que o usuário pode acessar
    const notificationIds = await knex("notifications")
      .whereIn("public_id", notificationPublicIds)
      .where(function () {
        this.whereNull("target_user_id").orWhere("target_user_id", userId);
      })
      .where("status", "active")
      .pluck("id");

    if (notificationIds.length === 0) {
      const error = new Error("Nenhuma notificação válida encontrada.");
      error.statusCode = 404;
      error.code = "NO_VALID_NOTIFICATIONS";
      throw error;
    }

    // Inserir registros de leitura (ignorar duplicatas)
    const readRecords = notificationIds.map((notificationId) => ({
      notification_id: notificationId,
      user_id: userId,
      read_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    }));

    const insertedCount = await knex("notification_reads")
      .insert(readRecords)
      .onConflict(["notification_id", "user_id"])
      .ignore();

    log.info(
      `[NotificationService] ${
        insertedCount.length || 0
      } notificações marcadas como lidas para usuário ${userId}`
    );

    return {
      message: "Notificações marcadas como lidas com sucesso.",
      marked_count: insertedCount.length || 0,
    };
  } catch (error) {
    if (error.statusCode === 404) {
      throw error;
    }

    log.error(
      error,
      `[NotificationService] Erro ao marcar notificações como lidas para usuário ${userId}`
    );
    const serviceError = new Error("Erro ao marcar notificações como lidas.");
    serviceError.statusCode = 500;
    serviceError.code = "NOTIFICATION_MARK_READ_ERROR";
    throw serviceError;
  }
}

/**
 * Marca todas as notificações não lidas do usuário como lidas
 * @param {object} fastify - Instância do Fastify
 * @param {number} userId - ID interno do usuário
 * @returns {Promise<object>} Resultado da operação
 */
async function markAllNotificationsAsRead(fastify, userId) {
  const { knex, log } = fastify;

  try {
    // Buscar todas as notificações não lidas do usuário
    const unreadNotificationIds = await knex("notifications as n")
      .leftJoin("notification_reads as nr", function () {
        this.on("n.id", "=", "nr.notification_id").andOn(
          "nr.user_id",
          "=",
          knex.raw("?", [userId])
        );
      })
      .where(function () {
        this.whereNull("n.target_user_id").orWhere("n.target_user_id", userId);
      })
      .where("n.status", "active")
      .where(function () {
        this.whereNull("n.expires_at").orWhere(
          "n.expires_at",
          ">",
          knex.fn.now()
        );
      })
      .whereNull("nr.id") // Não lidas
      .pluck("n.id");

    if (unreadNotificationIds.length === 0) {
      return {
        message: "Nenhuma notificação não lida encontrada.",
        marked_count: 0,
      };
    }

    // Inserir registros de leitura
    const readRecords = unreadNotificationIds.map((notificationId) => ({
      notification_id: notificationId,
      user_id: userId,
      read_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    }));

    await knex("notification_reads").insert(readRecords);

    log.info(
      `[NotificationService] ${unreadNotificationIds.length} notificações marcadas como lidas para usuário ${userId}`
    );

    return {
      message: "Todas as notificações foram marcadas como lidas.",
      marked_count: unreadNotificationIds.length,
    };
  } catch (error) {
    log.error(
      error,
      `[NotificationService] Erro ao marcar todas as notificações como lidas para usuário ${userId}`
    );
    const serviceError = new Error(
      "Erro ao marcar todas as notificações como lidas."
    );
    serviceError.statusCode = 500;
    serviceError.code = "NOTIFICATION_MARK_ALL_READ_ERROR";
    throw serviceError;
  }
}

module.exports = {
  getUserNotifications,
  getNotificationsSummary,
  getNotificationById,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
};
