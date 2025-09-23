// routes/companies/clients.js (ATUALIZADO)
"use strict";

module.exports = async function (fastify, opts) {
  const { services, schemas } = fastify;

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
            "Você não tem permissão para acessar os clientes desta empresa."
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

  // --- ROTAS DE CRUD PARA CLIENTES ---

  // POST /api/companies/:companyId/clients (OPERAÇÃO DE ESCRITA)
  fastify.post(
    "/:companyId/clients",
    { schema: schemas.createClientSchema, ...writePreHandler },
    async (request, reply) => {
      const newClient = await services.client.createClient(
        fastify,
        request.params.companyId,
        request.body
      );
      reply.code(201).send(newClient);
    }
  );

  // GET /api/companies/:companyId/clients (OPERAÇÃO DE LEITURA)
  fastify.get(
    "/:companyId/clients",
    { schema: schemas.listClientsSchema, ...readPreHandler },
    async (request, reply) => {
      const clients = await services.client.listClients(
        fastify,
        request.params.companyId
      );
      reply.send(clients);
    }
  );

  // GET /api/companies/:companyId/clients/:clientId (OPERAÇÃO DE LEITURA)
  fastify.get(
    "/:companyId/clients/:clientId",
    { schema: schemas.getClientByIdSchema, ...readPreHandler },
    async (request, reply) => {
      const client = await services.client.getClientById(
        fastify,
        request.params.companyId,
        request.params.clientId
      );
      reply.send(client);
    }
  );

  // PUT /api/companies/:companyId/clients/:clientId (OPERAÇÃO DE ESCRITA)
  fastify.put(
    "/:companyId/clients/:clientId",
    { schema: schemas.updateClientSchema, ...writePreHandler },
    async (request, reply) => {
      const updatedClient = await services.client.updateClient(
        fastify,
        request.params.companyId,
        request.params.clientId,
        request.body
      );
      reply.send(updatedClient);
    }
  );

  // DELETE /api/companies/:companyId/clients/:clientId (OPERAÇÃO DE ESCRITA)
  fastify.delete(
    "/:companyId/clients/:clientId",
    { schema: schemas.deleteClientSchema, ...writePreHandler },
    async (request, reply) => {
      const result = await services.client.deleteClient(
        fastify,
        request.params.companyId,
        request.params.clientId
      );
      reply.send(result);
    }
  );
};
