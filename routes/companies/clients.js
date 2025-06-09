"use strict";

module.exports = async function (fastify, opts) {
  // O autoload já disponibiliza 'services' e 'schemas' no objeto fastify
  const { services, schemas, knex } = fastify;

  // Hook de permissão para Clientes: Verifica se o usuário é proprietário OU tem um compartilhamento ativo.
  const clientsPreHandler = {
    preHandler: [
      fastify.authenticate,
      async function (request, reply) {
        const { companyId } = request.params;
        const { userId } = request.user;

        try {
          // 1. Tenta verificar se o usuário é o proprietário da empresa.
          // O método getCompanyById já contém a lógica que lança um erro se não for.
          await services.company.getCompanyById(fastify, userId, companyId);
          // Se o código continuar, significa que o usuário é o proprietário. Permissão concedida.
          return;
        } catch (ownerError) {
          // 2. Se não for o proprietário (o `catch` foi acionado), verifica se há um compartilhamento ativo.
          if (ownerError.statusCode === 403 || ownerError.statusCode === 404) {
            const share = await knex("company_shares")
              .where({
                company_id: companyId,
                shared_with_user_id: userId,
                status: "active",
              })
              .first();

            if (share) {
              // Usuário tem um compartilhamento ativo. Permissão concedida.
              // Futuramente, você pode adicionar lógicas mais finas aqui, baseadas no objeto `share.permissions`.
              // Ex: if (!share.permissions.can_view_clients) { throw new Error("Você não tem permissão para ver clientes."); }
              return;
            }
          }

          // 3. Se não for proprietário e não tiver compartilhamento, nega o acesso.
          const error = new Error(
            "Você não tem permissão para acessar os clientes desta empresa."
          );
          error.statusCode = 403;
          reply.code(403).send(error);
        }
      },
    ],
  };

  // --- DEFINIÇÃO DAS ROTAS DE CRUD PARA CLIENTES ---

  // POST /api/companies/:companyId/clients
  fastify.post(
    "/:companyId/clients",
    { schema: schemas.createClientSchema, ...clientsPreHandler },
    async (request, reply) => {
      const newClient = await services.client.createClient(
        fastify,
        request.params.companyId,
        request.body
      );
      reply.code(201).send(newClient);
    }
  );

  // GET /api/companies/:companyId/clients
  fastify.get(
    "/:companyId/clients",
    { schema: schemas.listClientsSchema, ...clientsPreHandler },
    async (request, reply) => {
      const clients = await services.client.listClients(
        fastify,
        request.params.companyId
      );
      reply.send(clients);
    }
  );

  // GET /api/companies/:companyId/clients/:clientId
  fastify.get(
    "/:companyId/clients/:clientId",
    { schema: schemas.getClientByIdSchema, ...clientsPreHandler },
    async (request, reply) => {
      const client = await services.client.getClientById(
        fastify,
        request.params.companyId,
        request.params.clientId
      );
      reply.send(client);
    }
  );

  // PUT /api/companies/:companyId/clients/:clientId
  fastify.put(
    "/:companyId/clients/:clientId",
    { schema: schemas.updateClientSchema, ...clientsPreHandler },
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

  // DELETE /api/companies/:companyId/clients/:clientId
  fastify.delete(
    "/:companyId/clients/:clientId",
    { schema: schemas.deleteClientSchema, ...clientsPreHandler },
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
