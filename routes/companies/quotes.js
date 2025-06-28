"use strict";

module.exports = async function (fastify, opts) {
  const { services, schemas, knex } = fastify;

  // Hook de permissão para Orçamentos: Verifica acesso à empresa e limites do plano
  const quotesPreHandler = {
    preHandler: [
      fastify.authenticate,
      async function (request, reply) {
        const { companyId } = request.params;
        const { userId } = request.user;

        try {
          // 1. Verifica se o usuário é proprietário da empresa
          let isOwner = false;
          let userPlan = null;

          try {
            await services.company.getCompanyById(fastify, userId, companyId);
            isOwner = true;

            // Busca o plano apenas se for proprietário
            userPlan = await services.permission.getUserPlan(fastify, userId);
          } catch (ownerError) {
            // Se não for proprietário, verifica compartilhamento
            if (
              ownerError.statusCode === 403 ||
              ownerError.statusCode === 404
            ) {
              const share = await knex("company_shares")
                .where({
                  company_id: companyId,
                  shared_with_user_id: userId,
                  status: "active",
                })
                .first();

              if (!share) {
                const error = new Error(
                  "Você não tem permissão para acessar os orçamentos desta empresa."
                );
                error.statusCode = 403;
                throw error;
              }

              // TODO: Verificar permissões específicas do compartilhamento
              // Ex: if (!share.permissions.can_manage_quotes) { throw error; }
            } else {
              throw ownerError;
            }
          }

          // 2. Para proprietários, verifica limites do plano na criação
          if (isOwner && request.method === "POST") {
            if (!userPlan) {
              const error = new Error("Usuário não possui um plano ativo.");
              error.statusCode = 403;
              throw error;
            }

            // Verifica limite de orçamentos por mês
            const currentMonthQuotes = await services.quote.getQuoteCount(
              fastify,
              companyId,
              "month"
            );

            const limitExceeded = services.permission.checkLimit(
              userPlan,
              "max_quotes_per_month",
              currentMonthQuotes
            );

            if (limitExceeded) {
              const error = new Error(
                `Limite de orçamentos por mês atingido para seu plano atual (${
                  userPlan.features?.max_quotes_per_month || 0
                }). Considere fazer upgrade para criar mais orçamentos.`
              );
              error.statusCode = 422;
              error.code = "PLAN_LIMIT_EXCEEDED";
              throw error;
            }

            // Verifica limite de itens por orçamento
            if (request.body && request.body.items) {
              const itemCount = request.body.items.length;
              const itemLimitExceeded = services.permission.checkLimit(
                userPlan,
                "max_items_per_quote",
                itemCount - 1 // -1 porque checkLimit usa >=
              );

              if (itemLimitExceeded) {
                const error = new Error(
                  `Limite de itens por orçamento atingido para seu plano atual (${
                    userPlan.features?.max_items_per_quote || 0
                  }). Considere fazer upgrade ou reduza o número de itens.`
                );
                error.statusCode = 422;
                error.code = "PLAN_LIMIT_EXCEEDED";
                throw error;
              }
            }
          }

          return;
        } catch (error) {
          reply.code(error.statusCode || 500).send({
            statusCode: error.statusCode || 500,
            error: error.code || "FORBIDDEN",
            message: error.message,
          });
        }
      },
    ],
  };

  // Helper para tratamento de erros dos serviços
  async function handleServiceCall(reply, serviceFn, ...args) {
    try {
      const result = await serviceFn(fastify, ...args);
      return result;
    } catch (error) {
      fastify.log.error(error, "[QuoteRoutes] Erro no serviço QuoteService");
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

  // --- ROTAS CRUD PARA ORÇAMENTOS ---

  // POST /api/companies/:companyId/quotes
  fastify.post(
    "/:companyId/quotes",
    { schema: schemas.createQuoteSchema, ...quotesPreHandler },
    async (request, reply) => {
      const newQuote = await handleServiceCall(
        reply,
        services.quote.createQuote.bind(services.quote),
        request.params.companyId,
        request.user.userId,
        request.body
      );
      if (newQuote) {
        reply.code(201).send(newQuote);
      }
    }
  );

  // GET /api/companies/:companyId/quotes
  fastify.get(
    "/:companyId/quotes",
    { schema: schemas.listQuotesSchema, ...quotesPreHandler },
    async (request, reply) => {
      const quotes = await handleServiceCall(
        reply,
        services.quote.listQuotes.bind(services.quote),
        request.params.companyId,
        request.query
      );
      if (quotes) {
        reply.send(quotes);
      }
    }
  );

  // GET /api/companies/:companyId/quotes/:quoteId
  fastify.get(
    "/:companyId/quotes/:quoteId",
    { schema: schemas.getQuoteByIdSchema, ...quotesPreHandler },
    async (request, reply) => {
      const quote = await handleServiceCall(
        reply,
        services.quote.getQuoteById.bind(services.quote),
        request.params.companyId,
        request.params.quoteId
      );
      if (quote) {
        reply.send(quote);
      }
    }
  );

  // PUT /api/companies/:companyId/quotes/:quoteId
  fastify.put(
    "/:companyId/quotes/:quoteId",
    { schema: schemas.updateQuoteSchema, ...quotesPreHandler },
    async (request, reply) => {
      const updatedQuote = await handleServiceCall(
        reply,
        services.quote.updateQuote.bind(services.quote),
        request.params.companyId,
        request.params.quoteId,
        request.body
      );
      if (updatedQuote) {
        reply.send(updatedQuote);
      }
    }
  );

  // PUT /api/companies/:companyId/quotes/:quoteId/status
  fastify.put(
    "/:companyId/quotes/:quoteId/status",
    { schema: schemas.updateQuoteStatusSchema, ...quotesPreHandler },
    async (request, reply) => {
      const updatedQuote = await handleServiceCall(
        reply,
        services.quote.updateQuoteStatus.bind(services.quote),
        request.params.companyId,
        request.params.quoteId,
        request.body.status
      );
      if (updatedQuote) {
        reply.send(updatedQuote);
      }
    }
  );

  // DELETE /api/companies/:companyId/quotes/:quoteId
  fastify.delete(
    "/:companyId/quotes/:quoteId",
    { schema: schemas.deleteQuoteSchema, ...quotesPreHandler },
    async (request, reply) => {
      const result = await handleServiceCall(
        reply,
        services.quote.deleteQuote.bind(services.quote),
        request.params.companyId,
        request.params.quoteId
      );
      if (result) {
        reply.send(result);
      }
    }
  );

  // --- ROTAS ADICIONAIS ÚTEIS ---

  // GET /api/companies/:companyId/quotes/stats
  fastify.get(
    "/:companyId/quotes/stats",
    {
      schema: {
        description: "Estatísticas dos orçamentos da empresa.",
        tags: ["Orçamentos"],
        summary: "Estatísticas de Orçamentos",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { companyId: { type: "integer" } },
          required: ["companyId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              total_quotes: { type: "integer" },
              draft_count: { type: "integer" },
              sent_count: { type: "integer" },
              accepted_count: { type: "integer" },
              rejected_count: { type: "integer" },
              total_accepted_value_cents: { type: "integer" },
              avg_accepted_value_cents: { type: "integer" },
              acceptance_rate: { type: "integer" },
            },
          },
        },
      },
      ...quotesPreHandler,
    },
    async (request, reply) => {
      const stats = await handleServiceCall(
        reply,
        services.quote.getQuoteStats.bind(services.quote),
        request.params.companyId
      );
      if (stats) {
        reply.send(stats);
      }
    }
  );

  // GET /api/companies/:companyId/quotes/expiring
  fastify.get(
    "/:companyId/quotes/expiring",
    {
      schema: {
        description: "Lista orçamentos próximos ao vencimento.",
        tags: ["Orçamentos"],
        summary: "Orçamentos Próximos ao Vencimento",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { companyId: { type: "integer" } },
          required: ["companyId"],
        },
        querystring: {
          type: "object",
          properties: {
            days: {
              type: "integer",
              minimum: 1,
              maximum: 30,
              default: 7,
              description: "Número de dias à frente para verificar",
            },
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
                expiry_date: { type: "string", format: "date" },
                total_amount_cents: { type: "integer" },
                client_name: { type: "string" },
                client_email: { type: ["string", "null"] },
              },
            },
          },
        },
      },
      ...quotesPreHandler,
    },
    async (request, reply) => {
      const expiringQuotes = await handleServiceCall(
        reply,
        services.quote.getExpiringQuotes.bind(services.quote),
        request.params.companyId,
        request.query.days || 7
      );
      if (expiringQuotes) {
        reply.send(expiringQuotes);
      }
    }
  );

  // GET /api/companies/:companyId/quotes/generate-number
  fastify.get(
    "/:companyId/quotes/generate-number",
    {
      schema: {
        description: "Gera um número automático para novo orçamento.",
        tags: ["Orçamentos"],
        summary: "Gerar Número de Orçamento",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { companyId: { type: "integer" } },
          required: ["companyId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              quote_number: { type: "string" },
            },
          },
        },
      },
      ...quotesPreHandler,
    },
    async (request, reply) => {
      const quoteNumber = await handleServiceCall(
        reply,
        services.quote.generateQuoteNumber.bind(services.quote),
        request.params.companyId
      );
      if (quoteNumber) {
        reply.send({ quote_number: quoteNumber });
      }
    }
  );
};
