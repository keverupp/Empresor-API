"use strict";

class ClientService {
  async createClient(fastify, companyId, clientData) {
    const { knex, log } = fastify;
    const { document_number } = clientData;

    // --- AJUSTE AQUI: VERIFICAÇÃO DE DUPLICIDADE ---
    // Se um número de documento foi fornecido, verifica se ele já existe para esta empresa
    if (document_number) {
      const existingClient = await knex("clients")
        .where({
          company_id: companyId,
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
          company_id: companyId,
        })
        .returning("*");
      log.info(`Cliente #${client.id} criado para a empresa #${companyId}`);
      return client;
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
    return fastify
      .knex("clients")
      .where({ company_id: companyId })
      .orderBy("name", "asc");
  }

  async getClientById(fastify, companyId, clientId) {
    const client = await fastify
      .knex("clients")
      .where({ id: clientId, company_id: companyId })
      .first();

    if (!client) {
      const error = new Error("Cliente não encontrado nesta empresa.");
      error.statusCode = 404;
      error.code = "CLIENT_NOT_FOUND";
      throw error;
    }
    return client;
  }

  async updateClient(fastify, companyId, clientId, updateData) {
    const { knex, log } = fastify;
    try {
      await this.getClientById(fastify, companyId, clientId);

      const [updatedClient] = await knex("clients")
        .where({ id: clientId, company_id: companyId })
        .update(
          {
            ...updateData,
            updated_at: knex.fn.now(),
          },
          "*"
        );

      log.info(`Cliente #${clientId} da empresa #${companyId} atualizado.`);
      return updatedClient;
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
    const result = await knex("clients")
      .where({ id: clientId, company_id: companyId })
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
