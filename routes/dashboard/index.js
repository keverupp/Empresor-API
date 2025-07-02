// routes/dashboard/index.js
"use strict";

const {
  dashboardSummarySchema,
  dashboardQuotationsSchema,
  dashboardCompanyStatsSchema,
  dashboardTimelineSchema,
  dashboardTopClientsSchema,
} = require("../../schemas/dashboardSchemas");

module.exports = async function (fastify, opts) {
  const DashboardService = fastify.services && fastify.services.dashboard;

  // Hook de autenticação
  const authHooks = [];

  if (fastify.authenticate) {
    authHooks.push(fastify.authenticate);
  } else {
    fastify.log.warn(
      "Hook fastify.authenticate não está definido! As rotas de /dashboard não serão protegidas."
    );
  }

  if (fastify.authPlan) {
    authHooks.push(fastify.authPlan);
  } else {
    fastify.log.warn(
      "Hook fastify.authPlan não está definido! As rotas de /dashboard não terão informações de plano."
    );
  }

  const preHandler = authHooks;

  // Handler de erros genérico para os serviços
  async function handleServiceCall(reply, serviceFn, ...args) {
    try {
      const result = await serviceFn(fastify, ...args);
      return result;
    } catch (error) {
      const serviceName =
        DashboardService?.constructor.name || "DashboardService";
      const methodName = serviceFn.name || "unknownMethod";
      fastify.log.error(
        error,
        `[DashboardRoutes] Erro no serviço ${serviceName}.${methodName}`
      );

      const statusCode = error.statusCode || 500;
      const errorCode =
        error.code ||
        (statusCode === 500 ? "InternalServerError" : "BadRequest");

      reply.code(statusCode).send({
        statusCode,
        error: errorCode,
        message: error.message,
      });
      return null;
    }
  }

  // GET /dashboard/summary
  fastify.get(
    "/summary",
    { schema: dashboardSummarySchema, preHandler },
    async (request, reply) => {
      const summary = await handleServiceCall(
        reply,
        DashboardService.getSummary.bind(DashboardService),
        request.user
      );
      if (summary) {
        reply.send(summary);
      }
    }
  );

  // GET /dashboard/quotations
  fastify.get(
    "/quotations",
    { schema: dashboardQuotationsSchema, preHandler },
    async (request, reply) => {
      const quotations = await handleServiceCall(
        reply,
        DashboardService.getQuotations.bind(DashboardService),
        request.user,
        request.query
      );
      if (quotations) {
        reply.send(quotations);
      }
    }
  );

  // GET /dashboard/stats/companies
  fastify.get(
    "/stats/companies",
    { schema: dashboardCompanyStatsSchema, preHandler },
    async (request, reply) => {
      const stats = await handleServiceCall(
        reply,
        DashboardService.getCompanyStats.bind(DashboardService),
        request.user,
        request.query
      );
      if (stats) {
        reply.send(stats);
      }
    }
  );

  // GET /dashboard/stats/timeline
  fastify.get(
    "/stats/timeline",
    { schema: dashboardTimelineSchema, preHandler },
    async (request, reply) => {
      const timeline = await handleServiceCall(
        reply,
        DashboardService.getTimeline.bind(DashboardService),
        request.user,
        request.query
      );
      if (timeline) {
        reply.send(timeline);
      }
    }
  );

  // GET /dashboard/stats/top-clients
  fastify.get(
    "/stats/top-clients",
    { schema: dashboardTopClientsSchema, preHandler },
    async (request, reply) => {
      const topClients = await handleServiceCall(
        reply,
        DashboardService.getTopClients.bind(DashboardService),
        request.user,
        request.query
      );
      if (topClients) {
        reply.send(topClients);
      }
    }
  );

  // GET /dashboard/stats/conversion
  fastify.get(
    "/stats/conversion",
    {
      schema: {
        description: "Estatísticas de conversão de orçamentos",
        tags: ["Dashboard"],
        summary: "Estatísticas de Conversão",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            date_from: { type: "string", format: "date" },
            date_to: { type: "string", format: "date" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              total_quotes: { type: "integer" },
              sent_quotes: { type: "integer" },
              viewed_quotes: { type: "integer" },
              accepted_quotes: { type: "integer" },
              invoiced_quotes: { type: "integer" },
              view_rate: { type: "number" },
              acceptance_rate: { type: "number" },
              invoice_rate: { type: "number" },
            },
          },
          401: { $ref: "ErrorResponse#" },
          500: { $ref: "ErrorResponse#" },
        },
      },
      preHandler,
    },
    async (request, reply) => {
      const conversionStats = await handleServiceCall(
        reply,
        DashboardService.getConversionStats.bind(DashboardService),
        request.user,
        request.query
      );
      if (conversionStats) {
        reply.send(conversionStats);
      }
    }
  );

  // GET /dashboard/expiring-quotes
  fastify.get(
    "/expiring-quotes",
    {
      schema: {
        description: "Orçamentos próximos do vencimento",
        tags: ["Dashboard"],
        summary: "Orçamentos Vencendo",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            days: { type: "integer", minimum: 1, maximum: 30, default: 7 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
          },
        },
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                quote_number: { type: "string" },
                title: { type: "string" },
                status: { type: "string" },
                expiry_date: { type: "string", format: "date" },
                total_amount_cents: { type: "integer" },
                company_name: { type: "string" },
                client: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    email: { type: ["string", "null"] },
                  },
                },
              },
            },
          },
          401: { $ref: "ErrorResponse#" },
          500: { $ref: "ErrorResponse#" },
        },
      },
      preHandler,
    },
    async (request, reply) => {
      const expiringQuotes = await handleServiceCall(
        reply,
        DashboardService.getExpiringQuotes.bind(DashboardService),
        request.user,
        request.query
      );
      if (expiringQuotes) {
        reply.send(expiringQuotes);
      }
    }
  );
};
