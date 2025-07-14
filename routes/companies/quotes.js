// routes/companies/quotes.js - ARQUIVO COMPLETO CORRIGIDO
"use strict";

module.exports = async function (fastify, opts) {
  const { services, schemas } = fastify;

  // Helper para tratamento de erros dos serviços
  async function handleServiceCall(reply, serviceFn, ...args) {
    try {
      const result = await serviceFn(...args);
      return result;
    } catch (error) {
      fastify.log.error(error, "Erro no serviço de orçamentos");
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

  // PreHandler base com autenticação e verificação de permissões
  const basePreHandler = {
    preHandler: [
      fastify.authenticate,
      async (request, reply) => {
        const companyId = request.params.companyId;
        const userId = request.user.userId;

        try {
          // 1. Verifica se o usuário é proprietário da empresa
          const company = await fastify
            .knex("companies")
            .select("id", "owner_id")
            .where("public_id", companyId)
            .first();

          if (!company) {
            const error = new Error("Empresa não encontrada.");
            error.statusCode = 404;
            throw error;
          }

          if (company.owner_id === userId) {
            return; // Proprietário sempre tem acesso
          }

          // 2. Se não for proprietário, verifica compartilhamentos
          const share = await fastify
            .knex("company_shares")
            .where("company_id", company.id)
            .where("shared_with_user_id", userId)
            .where("status", "active")
            .first();

          if (share) {
            return; // Usuário com compartilhamento ativo
          }

          // 3. Se não for proprietário e não tiver compartilhamento, nega o acesso
          const error = new Error(
            "Você não tem permissão para acessar os orçamentos desta empresa."
          );
          error.statusCode = 403;
          throw error;
        } catch (error) {
          if (error.statusCode) throw error;
          fastify.log.error(error, "Erro na verificação de permissões");
          throw new Error("Erro interno na verificação de permissões.");
        }
      },
    ],
  };

  // PreHandler para operações de leitura (permite acesso mesmo com empresa inativa para proprietários)
  const readPreHandler = {
    preHandler: [
      ...basePreHandler.preHandler,
      fastify.companyStatus.checkCompanyForReadsAndWrites(),
    ],
  };

  // PreHandler para operações de escrita (bloqueia se empresa inativa)
  const writePreHandler = {
    preHandler: [
      ...basePreHandler.preHandler,
      fastify.companyStatus.requireActiveCompanyForWrites(),
    ],
  };

  // --- ROTAS DE CRUD PARA ORÇAMENTOS ---

  // POST /api/companies/:companyId/quotes (OPERAÇÃO DE ESCRITA)
  fastify.post(
    "/:companyId/quotes",
    { schema: schemas.createQuoteSchema, ...writePreHandler },
    async (request, reply) => {
      const newQuote = await handleServiceCall(
        reply,
        services.quote.createQuote.bind(services.quote),
        fastify, // 1º: fastify instance
        request.params.companyId, // 2º: companyId
        request.user.userId, // 3º: userId
        request.body // 4º: quoteData
      );
      if (newQuote) {
        reply.code(201).send(newQuote);
      }
    }
  );

  // GET /api/companies/:companyId/quotes (OPERAÇÃO DE LEITURA)
  fastify.get(
    "/:companyId/quotes",
    { schema: schemas.listQuotesSchema, ...readPreHandler },
    async (request, reply) => {
      const quotes = await handleServiceCall(
        reply,
        services.quote.listQuotes.bind(services.quote),
        fastify, // 1º: fastify instance
        request.params.companyId, // 2º: companyId
        request.query // 3º: queryParams
      );
      if (quotes) {
        reply.send(quotes);
      }
    }
  );

  // GET /api/companies/:companyId/quotes/:quoteId (OPERAÇÃO DE LEITURA)
  fastify.get(
    "/:companyId/quotes/:quoteId",
    { schema: schemas.getQuoteByIdSchema, ...readPreHandler },
    async (request, reply) => {
      const quote = await handleServiceCall(
        reply,
        services.quote.getQuoteById.bind(services.quote),
        fastify, // 1º: fastify instance
        request.params.companyId, // 2º: companyId
        request.params.quoteId // 3º: quoteId
      );
      if (quote) {
        reply.send(quote);
      }
    }
  );

  // PUT /api/companies/:companyId/quotes/:quoteId (OPERAÇÃO DE ESCRITA)
  fastify.put(
    "/:companyId/quotes/:quoteId",
    { schema: schemas.updateQuoteSchema, ...writePreHandler },
    async (request, reply) => {
      const updatedQuote = await handleServiceCall(
        reply,
        services.quote.updateQuote.bind(services.quote),
        fastify, // 1º: fastify instance
        request.params.companyId, // 2º: companyId
        request.params.quoteId, // 3º: quoteId
        request.body // 4º: updateData
      );
      if (updatedQuote) {
        reply.send(updatedQuote);
      }
    }
  );

  // PUT /api/companies/:companyId/quotes/:quoteId/status (OPERAÇÃO DE ESCRITA)
  fastify.put(
    "/:companyId/quotes/:quoteId/status",
    { schema: schemas.updateQuoteStatusSchema, ...writePreHandler },
    async (request, reply) => {
      const updatedQuote = await handleServiceCall(
        reply,
        services.quote.updateQuoteStatus.bind(services.quote),
        fastify, // 1º: fastify instance
        request.params.companyId, // 2º: companyId
        request.params.quoteId, // 3º: quoteId
        request.body.status // 4º: status
      );
      if (updatedQuote) {
        reply.send(updatedQuote);
      }
    }
  );

  // DELETE /api/companies/:companyId/quotes/:quoteId (OPERAÇÃO DE ESCRITA)
  fastify.delete(
    "/:companyId/quotes/:quoteId",
    { schema: schemas.deleteQuoteSchema, ...writePreHandler },
    async (request, reply) => {
      const result = await handleServiceCall(
        reply,
        services.quote.deleteQuote.bind(services.quote),
        fastify, // 1º: fastify instance
        request.params.companyId, // 2º: companyId
        request.params.quoteId // 3º: quoteId
      );
      if (result) {
        reply.send(result);
      }
    }
  );

  // --- ROTAS ADICIONAIS ÚTEIS ---

  // GET /api/companies/:companyId/quotes/stats (OPERAÇÃO DE LEITURA)
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
          properties: {
            companyId: { type: "string" },
          },
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
          401: { $ref: "ErrorResponse#" },
          403: { $ref: "ErrorResponse#" },
          404: { $ref: "ErrorResponse#" },
          500: { $ref: "ErrorResponse#" },
        },
      },
      ...readPreHandler,
    },
    async (request, reply) => {
      const stats = await handleServiceCall(
        reply,
        services.quote.getQuoteStats.bind(services.quote),
        fastify, // 1º: fastify instance
        request.params.companyId // 2º: companyId
      );
      if (stats) {
        reply.send(stats);
      }
    }
  );

  // GET /api/companies/:companyId/quotes/expiring (OPERAÇÃO DE LEITURA)
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
          properties: { companyId: { type: "string" } },
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
          401: { $ref: "ErrorResponse#" },
          403: { $ref: "ErrorResponse#" },
          404: { $ref: "ErrorResponse#" },
          500: { $ref: "ErrorResponse#" },
        },
      },
      ...readPreHandler,
    },
    async (request, reply) => {
      const expiringQuotes = await handleServiceCall(
        reply,
        services.quote.getExpiringQuotes.bind(services.quote),
        fastify, // 1º: fastify instance
        request.params.companyId, // 2º: companyId
        request.query.days || 7 // 3º: days
      );
      if (expiringQuotes) {
        reply.send(expiringQuotes);
      }
    }
  );

  // GET /api/companies/:companyId/quotes/generate-number (OPERAÇÃO DE LEITURA)
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
          properties: { companyId: { type: "string" } },
          required: ["companyId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              quote_number: { type: "string" },
            },
          },
          401: { $ref: "ErrorResponse#" },
          403: { $ref: "ErrorResponse#" },
          404: { $ref: "ErrorResponse#" },
          500: { $ref: "ErrorResponse#" },
        },
      },
      ...readPreHandler,
    },
    async (request, reply) => {
      const quoteNumber = await handleServiceCall(
        reply,
        services.quote.generateQuoteNumber.bind(services.quote),
        fastify, // 1º: fastify instance
        request.params.companyId // 2º: companyId
      );
      if (quoteNumber) {
        reply.send({ quote_number: quoteNumber });
      }
    }
  );
};
