"use strict";

class QuoteService {
  /**
   * Cria um novo orçamento com itens
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {number} userId
   * @param {object} quoteData
   * @returns {Promise<object>}
   */
  async createQuote(fastify, companyId, userId, quoteData) {
    const { knex, log } = fastify;
    const {
      client_id,
      quote_number,
      items,
      issue_date,
      expiry_date,
      notes,
      internal_notes,
      terms_and_conditions_content,
      discount_type,
      discount_value_cents,
      tax_amount_cents,
      currency = "BRL",
    } = quoteData;

    // Verifica se o cliente pertence à empresa
    const client = await knex("clients")
      .where({ id: client_id, company_id: companyId })
      .first();

    if (!client) {
      const error = new Error("Cliente não encontrado nesta empresa.");
      error.statusCode = 404;
      error.code = "CLIENT_NOT_FOUND";
      throw error;
    }

    // Verifica se o número do orçamento já existe na empresa
    const existingQuote = await knex("quotes")
      .where({ company_id: companyId, quote_number })
      .first();

    if (existingQuote) {
      const error = new Error(
        "Já existe um orçamento com este número nesta empresa."
      );
      error.statusCode = 409;
      error.code = "QUOTE_NUMBER_CONFLICT";
      throw error;
    }

    // Calcula totais
    const totals = this._calculateTotals(
      items,
      discount_type,
      discount_value_cents,
      tax_amount_cents
    );

    const transaction = await knex.transaction();

    try {
      // Cria o orçamento com tratamento robusto para campos opcionais
      const [quote] = await transaction("quotes")
        .insert({
          company_id: companyId,
          client_id,
          created_by_user_id: userId,
          quote_number,
          status: "draft",
          issue_date: issue_date || new Date().toISOString().split("T")[0],
          expiry_date,
          notes,
          internal_notes,
          terms_and_conditions_content,
          subtotal_cents: totals.subtotal,

          // Tratamento correto para desconto
          discount_type: discount_type || null,
          discount_value_cents: discount_type
            ? discount_value_cents || 0
            : null,

          // Tratamento correto para imposto
          tax_amount_cents: tax_amount_cents ?? null,

          total_amount_cents: totals.total,
          currency,
        })
        .returning("*");

      // Cria os itens do orçamento
      const quoteItems = items.map((item, index) => ({
        quote_id: quote.id,
        product_id: item.product_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        total_price_cents: Math.round(item.quantity * item.unit_price_cents),
        item_order: index + 1,
      }));

      // Insere os itens do orçamento (constante 'insertedItems' removida)
      await transaction("quote_items").insert(quoteItems).returning("*");

      await transaction.commit();

      log.info(`Orçamento #${quote.id} criado para a empresa #${companyId}`);

      // Retorna o orçamento completo
      return this.getQuoteById(fastify, companyId, quote.id);
    } catch (error) {
      await transaction.rollback();
      log.error(error, `Erro ao criar orçamento para a empresa #${companyId}`);

      if (error.code === "23505") {
        const customError = new Error(
          "Já existe um orçamento com este número nesta empresa."
        );
        customError.statusCode = 409;
        customError.code = "QUOTE_NUMBER_CONFLICT";
        throw customError;
      }

      throw new Error("Não foi possível criar o orçamento.");
    }
  }

  /**
   * Lista orçamentos de uma empresa com paginação e filtros
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {object} queryParams
   * @returns {Promise<object>}
   */
  async listQuotes(fastify, companyId, queryParams = {}) {
    const { knex } = fastify;
    const {
      page = 1,
      pageSize = 10,
      status,
      client_id,
      quote_number,
      issue_date_from,
      issue_date_to,
      expiry_date_from,
      expiry_date_to,
    } = queryParams;

    const offset = (page - 1) * pageSize;

    // Query principal com JOIN para trazer dados do cliente
    let query = knex("quotes as q")
      .leftJoin("clients as c", "q.client_id", "c.id")
      .where("q.company_id", companyId)
      .select(
        "q.*",
        knex.raw(`
          json_build_object(
            'id', c.id,
            'name', c.name,
            'email', c.email,
            'phone_number', c.phone_number,
            'document_number', c.document_number
          ) as client
        `)
      );

    // Query para contagem
    let countQuery = knex("quotes")
      .where({ company_id: companyId })
      .count("id as total");

    // Aplicar filtros
    if (status) {
      query = query.where("q.status", status);
      countQuery = countQuery.where("status", status);
    }

    if (client_id) {
      query = query.where("q.client_id", client_id);
      countQuery = countQuery.where("client_id", client_id);
    }

    if (quote_number) {
      query = query.where("q.quote_number", "like", `%${quote_number}%`);
      countQuery = countQuery.where(
        "quote_number",
        "like",
        `%${quote_number}%`
      );
    }

    if (issue_date_from) {
      query = query.where("q.issue_date", ">=", issue_date_from);
      countQuery = countQuery.where("issue_date", ">=", issue_date_from);
    }

    if (issue_date_to) {
      query = query.where("q.issue_date", "<=", issue_date_to);
      countQuery = countQuery.where("issue_date", "<=", issue_date_to);
    }

    if (expiry_date_from) {
      query = query.where("q.expiry_date", ">=", expiry_date_from);
      countQuery = countQuery.where("expiry_date", ">=", expiry_date_from);
    }

    if (expiry_date_to) {
      query = query.where("q.expiry_date", "<=", expiry_date_to);
      countQuery = countQuery.where("expiry_date", "<=", expiry_date_to);
    }

    try {
      const quotes = await query
        .orderBy("q.created_at", "desc")
        .limit(pageSize)
        .offset(offset);

      const [{ total: totalItems }] = await countQuery;
      const totalPages = Math.ceil(totalItems / pageSize);

      // Para cada orçamento, busca os itens
      const quotesWithItems = await Promise.all(
        quotes.map(async (quote) => {
          const items = await knex("quote_items")
            .where({ quote_id: quote.id })
            .orderBy("item_order", "asc");

          return {
            ...quote,
            items,
          };
        })
      );

      return {
        data: quotesWithItems,
        pagination: {
          totalItems: parseInt(totalItems),
          totalPages,
          currentPage: parseInt(page),
          pageSize: parseInt(pageSize),
        },
      };
    } catch (error) {
      fastify.log.error(error, "Erro ao listar orçamentos");
      throw new Error("Não foi possível listar os orçamentos.");
    }
  }

  /**
   * Busca um orçamento específico por ID com todos os detalhes
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {number} quoteId
   * @returns {Promise<object>}
   */
  async getQuoteById(fastify, companyId, quoteId) {
    const { knex } = fastify;

    const quote = await knex("quotes as q")
      .leftJoin("clients as c", "q.client_id", "c.id")
      .where({ "q.id": quoteId, "q.company_id": companyId })
      .select(
        "q.*",
        knex.raw(`
          json_build_object(
            'id', c.id,
            'name', c.name,
            'email', c.email,
            'phone_number', c.phone_number,
            'document_number', c.document_number,
            'address_street', c.address_street,
            'address_city', c.address_city,
            'address_state', c.address_state,
            'address_zip_code', c.address_zip_code
          ) as client
        `)
      )
      .first();

    if (!quote) {
      const error = new Error("Orçamento não encontrado nesta empresa.");
      error.statusCode = 404;
      error.code = "QUOTE_NOT_FOUND";
      throw error;
    }

    // Busca os itens do orçamento
    const items = await knex("quote_items")
      .where({ quote_id: quoteId })
      .orderBy("item_order", "asc");

    return {
      ...quote,
      items,
    };
  }

  /**
   * Atualiza um orçamento específico
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {number} quoteId
   * @param {object} updateData
   * @returns {Promise<object>}
   */
  async updateQuote(fastify, companyId, quoteId, updateData) {
    const { knex, log } = fastify;

    // Verifica se o orçamento existe e pertence à empresa
    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);

    // Verifica se o orçamento pode ser editado
    if (["accepted", "invoiced"].includes(existingQuote.status)) {
      const error = new Error(
        "Orçamentos aceitos ou faturados não podem ser editados."
      );
      error.statusCode = 422;
      error.code = "QUOTE_NOT_EDITABLE";
      throw error;
    }

    const transaction = await knex.transaction();

    try {
      // Prepara os dados da atualização do orçamento
      const quoteUpdateData = { updated_at: knex.fn.now() };

      // Campos simples que podem ser atualizados
      const simpleFields = [
        "client_id",
        "quote_number",
        "status",
        "issue_date",
        "expiry_date",
        "notes",
        "internal_notes",
        "terms_and_conditions_content",
        "discount_type",
        "discount_value_cents",
        "tax_amount_cents",
      ];

      simpleFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          quoteUpdateData[field] = updateData[field];
        }
      });

      // Se houver novos itens, recalcula os totais
      if (updateData.items) {
        const totals = this._calculateTotals(
          updateData.items,
          updateData.discount_type || existingQuote.discount_type,
          updateData.discount_value_cents !== undefined
            ? updateData.discount_value_cents
            : existingQuote.discount_value_cents,
          updateData.tax_amount_cents !== undefined
            ? updateData.tax_amount_cents
            : existingQuote.tax_amount_cents
        );

        quoteUpdateData.subtotal_cents = totals.subtotal;
        quoteUpdateData.total_amount_cents = totals.total;

        // Remove itens antigos
        await transaction("quote_items").where({ quote_id: quoteId }).del();

        // Insere novos itens
        const newItems = updateData.items.map((item, index) => ({
          quote_id: quoteId,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          total_price_cents: Math.round(item.quantity * item.unit_price_cents),
          item_order: index + 1,
        }));

        await transaction("quote_items").insert(newItems);
      }

      // Atualiza o orçamento
      await transaction("quotes")
        .where({ id: quoteId, company_id: companyId })
        .update(quoteUpdateData);

      await transaction.commit();

      log.info(`Orçamento #${quoteId} da empresa #${companyId} atualizado.`);

      // Retorna o orçamento atualizado
      return this.getQuoteById(fastify, companyId, quoteId);
    } catch (error) {
      await transaction.rollback();
      log.error(error, `Erro ao atualizar orçamento #${quoteId}`);

      if (error.code === "23505") {
        const customError = new Error(
          "O número do orçamento fornecido já pertence a outro orçamento desta empresa."
        );
        customError.statusCode = 409;
        customError.code = "QUOTE_NUMBER_CONFLICT";
        throw customError;
      }

      if (error.statusCode) throw error;
      throw new Error("Não foi possível atualizar o orçamento.");
    }
  }

  /**
   * Atualiza apenas o status de um orçamento
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {number} quoteId
   * @param {string} newStatus
   * @returns {Promise<object>}
   */
  async updateQuoteStatus(fastify, companyId, quoteId, newStatus) {
    const { knex, log } = fastify;

    // Verifica se o orçamento existe
    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);

    const updateData = {
      status: newStatus,
      updated_at: knex.fn.now(),
    };

    // Define timestamps específicos baseados no status
    if (newStatus === "accepted" && existingQuote.status !== "accepted") {
      updateData.accepted_at = knex.fn.now();
    }

    if (newStatus === "rejected" && existingQuote.status !== "rejected") {
      updateData.rejected_at = knex.fn.now();
    }

    try {
      await knex("quotes")
        .where({ id: quoteId, company_id: companyId })
        .update(updateData);

      log.info(`Status do orçamento #${quoteId} alterado para ${newStatus}`);

      return this.getQuoteById(fastify, companyId, quoteId);
    } catch (error) {
      log.error(error, `Erro ao atualizar status do orçamento #${quoteId}`);
      throw new Error("Não foi possível atualizar o status do orçamento.");
    }
  }

  /**
   * Exclui um orçamento específico
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {number} quoteId
   * @returns {Promise<object>}
   */
  async deleteQuote(fastify, companyId, quoteId) {
    const { knex, log } = fastify;

    // Verifica se o orçamento existe
    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);

    // Verifica se o orçamento pode ser excluído
    if (["accepted", "invoiced"].includes(existingQuote.status)) {
      const error = new Error(
        "Orçamentos aceitos ou faturados não podem ser excluídos."
      );
      error.statusCode = 422;
      error.code = "QUOTE_NOT_DELETABLE";
      throw error;
    }

    const transaction = await knex.transaction();

    try {
      // Remove primeiro os itens (devido à foreign key)
      await transaction("quote_items").where({ quote_id: quoteId }).del();

      // Remove o orçamento
      const result = await transaction("quotes")
        .where({ id: quoteId, company_id: companyId })
        .del();

      await transaction.commit();

      if (result === 0) {
        const error = new Error("Orçamento não encontrado para exclusão.");
        error.statusCode = 404;
        error.code = "QUOTE_NOT_FOUND";
        throw error;
      }

      log.info(`Orçamento #${quoteId} da empresa #${companyId} excluído.`);
      return { message: "Orçamento excluído com sucesso." };
    } catch (error) {
      await transaction.rollback();
      log.error(error, `Erro ao excluir orçamento #${quoteId}`);

      if (error.statusCode) throw error;
      throw new Error("Não foi possível excluir o orçamento.");
    }
  }

  /**
   * Conta o número total de orçamentos de uma empresa em um período
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {string} period - 'month', 'year' ou 'all'
   * @returns {Promise<number>}
   */
  async getQuoteCount(fastify, companyId, period = "month") {
    const { knex } = fastify;

    let query = knex("quotes").where({ company_id: companyId });

    if (period === "month") {
      // Orçamentos do mês atual
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      query = query.where("created_at", ">=", startOfMonth.toISOString());
    } else if (period === "year") {
      // Orçamentos do ano atual
      const startOfYear = new Date();
      startOfYear.setMonth(0, 1);
      startOfYear.setHours(0, 0, 0, 0);

      query = query.where("created_at", ">=", startOfYear.toISOString());
    }

    const [{ count }] = await query.count("id as count");
    return parseInt(count);
  }

  /**
   * Gera número automático para orçamento
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @returns {Promise<string>}
   */
  async generateQuoteNumber(fastify, companyId) {
    const { knex } = fastify;

    // Busca o último número de orçamento da empresa
    const lastQuote = await knex("quotes")
      .where({ company_id: companyId })
      .orderBy("id", "desc")
      .first();

    const currentYear = new Date().getFullYear();

    if (!lastQuote) {
      return `${currentYear}-001`;
    }

    // Extrai o número sequencial do último orçamento
    const lastNumber = lastQuote.quote_number;
    const match = lastNumber.match(/(\d{4})-(\d+)$/);

    if (match) {
      const year = parseInt(match[1]);
      const sequence = parseInt(match[2]);

      if (year === currentYear) {
        const nextSequence = sequence + 1;
        return `${currentYear}-${nextSequence.toString().padStart(3, "0")}`;
      }
    }

    // Se o ano mudou ou formato não reconhecido, começa do 001
    return `${currentYear}-001`;
  }

  /**
   * Calcula totais do orçamento
   * @private
   * @param {Array} items
   * @param {string} discountType
   * @param {number} discountValue
   * @param {number} taxAmount
   * @returns {object}
   */
  _calculateTotals(items, discountType, discountValue = 0, taxAmount = 0) {
    // Calcula subtotal
    const subtotal = items.reduce((sum, item) => {
      return sum + item.quantity * item.unit_price_cents;
    }, 0);

    // Calcula desconto
    let discountAmount = 0;
    if (discountType === "percentage" && discountValue > 0) {
      discountAmount = Math.round(subtotal * (discountValue / 100));
    } else if (discountType === "fixed_amount" && discountValue > 0) {
      discountAmount = discountValue;
    }

    // Calcula total
    const total = subtotal - discountAmount + (taxAmount || 0);

    return {
      subtotal: Math.round(subtotal),
      discount: Math.round(discountAmount),
      tax: Math.round(taxAmount || 0),
      total: Math.round(total),
    };
  }

  /**
   * Busca orçamentos próximos ao vencimento
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {number} daysAhead
   * @returns {Promise<Array>}
   */
  async getExpiringQuotes(fastify, companyId, daysAhead = 7) {
    const { knex } = fastify;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return knex("quotes as q")
      .leftJoin("clients as c", "q.client_id", "c.id")
      .where("q.company_id", companyId)
      .where("q.status", "sent")
      .where("q.expiry_date", "<=", futureDate.toISOString().split("T")[0])
      .where("q.expiry_date", ">=", new Date().toISOString().split("T")[0])
      .select("q.*", "c.name as client_name", "c.email as client_email")
      .orderBy("q.expiry_date", "asc");
  }

  /**
   * Estatísticas de orçamentos
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @returns {Promise<object>}
   */
  async getQuoteStats(fastify, companyId) {
    const { knex } = fastify;

    const stats = await knex("quotes")
      .where({ company_id: companyId })
      .select(
        knex.raw("COUNT(*) as total_quotes"),
        knex.raw("COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count"),
        knex.raw("COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count"),
        knex.raw(
          "COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_count"
        ),
        knex.raw(
          "COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count"
        ),
        knex.raw(
          "SUM(CASE WHEN status = 'accepted' THEN total_amount_cents ELSE 0 END) as total_accepted_value"
        ),
        knex.raw(
          "AVG(CASE WHEN status = 'accepted' THEN total_amount_cents END) as avg_accepted_value"
        )
      )
      .first();

    const accepted = parseInt(stats.accepted_count, 10);
    const rejected = parseInt(stats.rejected_count, 10);
    const totalConsidered = accepted + rejected;

    const acceptanceRate =
      totalConsidered > 0 ? Math.round((accepted / totalConsidered) * 100) : 0;

    return {
      total_quotes: parseInt(stats.total_quotes, 10),
      draft_count: parseInt(stats.draft_count, 10),
      sent_count: parseInt(stats.sent_count, 10),
      accepted_count: accepted,
      rejected_count: rejected,
      total_accepted_value_cents: parseInt(stats.total_accepted_value, 10) || 0,
      avg_accepted_value_cents:
        Math.round(parseFloat(stats.avg_accepted_value)) || 0,
      acceptance_rate: acceptanceRate,
    };
  }
}

module.exports = new QuoteService();
