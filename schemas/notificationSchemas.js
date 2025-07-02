// schemas/notificationSchemas.js
"use strict";

// Schemas reutilizáveis (building blocks)
const NotificationResponse = {
  $id: "NotificationResponse",
  type: "object",
  properties: {
    id: { type: "string", description: "ID público da notificação" },
    type: { type: "string", description: "Tipo da notificação" },
    title: { type: "string", description: "Título da notificação" },
    content: { type: "string", description: "Conteúdo da notificação" },
    priority: {
      type: "string",
      enum: ["low", "normal", "high", "urgent"],
      description: "Prioridade da notificação",
    },
    action_url: {
      type: ["string", "null"],
      description: "URL de ação opcional",
    },
    metadata: {
      type: "object",
      description: "Dados adicionais da notificação",
    },
    is_read: {
      type: "boolean",
      description: "Indica se a notificação foi lida pelo usuário",
    },
    read_at: {
      type: ["string", "null"],
      format: "date-time",
      description: "Data/hora quando a notificação foi lida",
    },
    created_at: {
      type: "string",
      format: "date-time",
      description: "Data de criação da notificação",
    },
    expires_at: {
      type: ["string", "null"],
      format: "date-time",
      description: "Data de expiração da notificação",
    },
  },
};

const NotificationSummary = {
  $id: "NotificationSummary",
  type: "object",
  properties: {
    total_notifications: {
      type: "integer",
      description: "Total de notificações para o usuário",
    },
    unread_count: {
      type: "integer",
      description: "Quantidade de notificações não lidas",
    },
    urgent_unread_count: {
      type: "integer",
      description: "Quantidade de notificações urgentes não lidas",
    },
  },
};

const MarkAsReadPayload = {
  $id: "MarkAsReadPayload",
  type: "object",
  properties: {
    notification_ids: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      description: "Array de IDs das notificações para marcar como lidas",
    },
  },
  required: ["notification_ids"],
};

// Schemas de rota completos

// GET /api/users/me/notifications
const listUserNotificationsSchema = {
  description:
    "Lista as notificações do usuário autenticado com opções de filtro e paginação.",
  tags: ["Usuário - Notificações"],
  summary: "Listar Minhas Notificações",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["all", "unread", "read"],
        default: "all",
        description: "Filtro por status de leitura",
      },
      type: {
        type: "string",
        description: "Filtro por tipo de notificação",
      },
      priority: {
        type: "string",
        enum: ["low", "normal", "high", "urgent"],
        description: "Filtro por prioridade",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        default: 20,
        description: "Número máximo de notificações por página",
      },
      offset: {
        type: "integer",
        minimum: 0,
        default: 0,
        description: "Número de notificações para pular (paginação)",
      },
    },
  },
  response: {
    200: {
      description: "Lista de notificações retornada com sucesso.",
      type: "object",
      properties: {
        notifications: {
          type: "array",
          items: { $ref: "NotificationResponse#" },
        },
        pagination: {
          type: "object",
          properties: {
            total: { type: "integer" },
            limit: { type: "integer" },
            offset: { type: "integer" },
            has_more: { type: "boolean" },
          },
        },
      },
    },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// GET /api/users/me/notifications/summary
const getNotificationsSummarySchema = {
  description: "Retorna um resumo das notificações do usuário (contadores).",
  tags: ["Usuário - Notificações"],
  summary: "Obter Resumo de Notificações",
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: "Resumo de notificações retornado com sucesso.",
      $ref: "NotificationSummary#",
    },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// GET /api/users/me/notifications/:notificationId
const getNotificationByIdSchema = {
  description: "Obtém uma notificação específica pelo seu ID.",
  tags: ["Usuário - Notificações"],
  summary: "Obter Notificação por ID",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: {
      notificationId: {
        type: "string",
        description: "ID público da notificação",
      },
    },
    required: ["notificationId"],
  },
  response: {
    200: {
      description: "Notificação retornada com sucesso.",
      $ref: "NotificationResponse#",
    },
    401: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// POST /api/users/me/notifications/mark-read
const markNotificationsAsReadSchema = {
  description: "Marca uma ou múltiplas notificações como lidas.",
  tags: ["Usuário - Notificações"],
  summary: "Marcar Notificações como Lidas",
  security: [{ bearerAuth: [] }],
  body: { $ref: "MarkAsReadPayload#" },
  response: {
    200: {
      description: "Notificações marcadas como lidas com sucesso.",
      type: "object",
      properties: {
        message: { type: "string" },
        marked_count: {
          type: "integer",
          description: "Número de notificações marcadas como lidas",
        },
      },
    },
    400: { $ref: "ErrorResponse#" },
    401: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// POST /api/users/me/notifications/mark-all-read
const markAllNotificationsAsReadSchema = {
  description: "Marca todas as notificações não lidas do usuário como lidas.",
  tags: ["Usuário - Notificações"],
  summary: "Marcar Todas as Notificações como Lidas",
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      description: "Todas as notificações marcadas como lidas com sucesso.",
      type: "object",
      properties: {
        message: { type: "string" },
        marked_count: {
          type: "integer",
          description: "Número de notificações marcadas como lidas",
        },
      },
    },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// Exporta schemas para serem carregados pelo plugin loadSchemas.js
module.exports = {
  // Schemas compartilhados para referência via $ref
  sharedSchemas: [NotificationResponse, NotificationSummary, MarkAsReadPayload],

  // Schemas de rota que serão acessados via fastify.schemas
  listUserNotificationsSchema,
  getNotificationsSummarySchema,
  getNotificationByIdSchema,
  markNotificationsAsReadSchema,
  markAllNotificationsAsReadSchema,
};
