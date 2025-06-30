"use strict";

function mapClientPublicId(client) {
  if (!client) return null;
  const { id: _ignored, public_id, company_public_id, ...rest } = client;
  return {
    id: public_id,
    company_id: company_public_id || client.company_id,
    ...rest,
  };
}

class ClientService {
  async _resolveCompanyId(knex, identifier) {
    if (/^\d+$/.test(String(identifier))) {
      return parseInt(identifier, 10);
    }
    const row = await knex("companies")
      .select("id")
      .where("public_id", identifier)
      .first();
    return row ? row.id : null;
  }

  async _resolveClientId(knex, identifier) {
    if (/^\d+$/.test(String(identifier))) {
      return parseInt(identifier, 10);
    }
    const row = await knex("clients")
      .select("id")
      .where("public_id", identifier)
      .first();
    return row ? row.id : null;
  }
  async createClient(fastify, companyId, clientData) {
    const { knex, log } = fastify;
    const { document_number } = clientData;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);

    // --- AJUSTE AQUI: VERIFICAÇÃO DE DUPLICIDADE ---
    // Se um número de documento foi fornecido, verifica se ele já existe para esta empresa
    if (document_number) {
      const existingClient = await knex("clients")
        .where({
          company_id: companyInternalId,
          document_number: document_number,
        })
        .first();

      // Se encontrar, lança um erro 409 (Conflict) com uma mensagem clara
      if (existingClient) {
        const error = new Error(
          "Já existe um cliente com este número de documento nesta empresa."
        );
        error.statusCode = 409;
        error.code = "CLIENT_DOCUMENT_CONFLICT";
        throw error;
      }
    }

    try {
      const [client] = await knex("clients")
        .insert({
          ...clientData,
          company_id: companyInternalId,
        })
        .returning("*");
      log.info(`Cliente #${client.id} criado para a empresa #${companyId}`);
      return this.getClientById(fastify, companyId, client.public_id);
    } catch (error) {
      log.error(error, `Erro ao criar cliente para a empresa #${companyId}`);

      // --- AJUSTE AQUI: TRATAMENTO DO ERRO DO BANCO ---
      // Como segurança extra, captura o erro de violação de unicidade do PostgreSQL
      if (error.code === "23505") {
        // 23505 = unique_violation
        const customError = new Error(
          "Já existe um cliente com este número de documento nesta empresa."
        );
        customError.statusCode = 409;
        customError.code = "CLIENT_DOCUMENT_CONFLICT";
        throw customError;
      }

      // Lança um erro genérico para outros problemas
      throw new Error("Não foi possível criar o cliente.");
    }
  }

  async listClients(fastify, companyId) {
    const companyInternalId = await this._resolveCompanyId(
      fastify.knex,
      companyId
    );
    const clients = await fastify
      .knex("clients as cl")
      .join("companies as c", "cl.company_id", "c.id")
      .where("cl.company_id", companyInternalId)
      .select("cl.*", "c.public_id as company_public_id")
      .orderBy("cl.name", "asc");
    return clients.map(mapClientPublicId);
  }

  async getClientById(fastify, companyId, clientId) {
    const companyInternalId = await this._resolveCompanyId(
      fastify.knex,
      companyId
    );
    const clientInternalId = await this._resolveClientId(
      fastify.knex,
      clientId
    );
    const client = await fastify
      .knex("clients as cl")
      .join("companies as c", "cl.company_id", "c.id")
      .where({ "cl.id": clientInternalId, "cl.company_id": companyInternalId })
      .select("cl.*", "c.public_id as company_public_id")
      .first();

    if (!client) {
      const error = new Error("Cliente não encontrado nesta empresa.");
      error.statusCode = 404;
      error.code = "CLIENT_NOT_FOUND";
      throw error;
    }
    return mapClientPublicId(client);
  }

  async updateClient(fastify, companyId, clientId, updateData) {
    const { knex, log } = fastify;
    try {
      await this.getClientById(fastify, companyId, clientId);
      const companyInternalId = await this._resolveCompanyId(knex, companyId);
      const clientInternalId = await this._resolveClientId(knex, clientId);
      const [updatedClient] = await knex("clients")
        .where({ id: clientInternalId, company_id: companyInternalId })
        .update(
          {
            ...updateData,
            updated_at: knex.fn.now(),
          },
          "*"
        );

      log.info(`Cliente #${clientId} da empresa #${companyId} atualizado.`);
      return this.getClientById(fastify, companyId, updatedClient.public_id);
    } catch (error) {
      if (error.statusCode === 404) throw error;
      log.error(error, `Erro ao atualizar cliente #${clientId}`);
      // Você também pode adicionar a verificação de erro 23505 aqui para a rota de update
      if (error.code === "23505") {
        const customError = new Error(
          "O número de documento fornecido já pertence a outro cliente."
        );
        customError.statusCode = 409;
        throw customError;
      }
      throw new Error("Não foi possível atualizar o cliente.");
    }
  }

  async deleteClient(fastify, companyId, clientId) {
    const { knex, log } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const clientInternalId = await this._resolveClientId(knex, clientId);
    const result = await knex("clients")
      .where({ id: clientInternalId, company_id: companyInternalId })
      .del();

    if (result === 0) {
      const error = new Error("Cliente não encontrado para exclusão.");
      error.statusCode = 404;
      error.code = "CLIENT_NOT_FOUND";
      throw error;
    }

    log.info(`Cliente #${clientId} da empresa #${companyId} excluído.`);
    return { message: "Cliente excluído com sucesso." };
  }
}

module.exports = new ClientService();
