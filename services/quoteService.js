"use strict";

/** ---------------- Helpers numéricos e arredondamento ---------------- */
const toNumber = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const toInt = (v, def = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : def;
};

// total da linha em centavos (quantity * unit_price_cents), com arredondamento consistente
function calcLineTotalCents(quantity, unit_price_cents) {
  const qty = toNumber(quantity, 0);
  const unit = toInt(unit_price_cents, 0);
  return Math.round(qty * unit);
}

/** ---------------- Mapper público <-> interno ---------------- */
function mapQuotePublicId(quote) {
  if (!quote) return null;
  const {
    id: _ignored,
    public_id,
    company_public_id,
    client_public_id,
    created_by_user_public_id,
    company_id: _company_internal_id, // ← Extraído para não sobrescrever
    client_id: _client_internal_id, // ← Extraído para não sobrescrever
    created_by_user_id: _user_internal_id, // ← Extraído para não sobrescrever
    items,
    subtotal_cents,
    discount_value_cents,
    tax_amount_cents,
    total_amount_cents,
    ...rest
  } = quote;

  const mappedItems = Array.isArray(items)
    ? items.map((it) => {
        const {
          product_public_id,
          product_id: _product_internal_id, // ← Extraído para não sobrescrever
          unit_price_cents,
          total_price_cents,
          quantity,
          ...itemRest
        } = it;
        return {
          ...itemRest,
          product_id: String(product_public_id || _product_internal_id),
          quantity: quantity !== undefined ? toNumber(quantity, 0) : undefined,
          unit_price_cents:
            unit_price_cents !== undefined
              ? toInt(unit_price_cents, 0)
              : undefined,
          total_price_cents:
            total_price_cents !== undefined
              ? toInt(total_price_cents, 0)
              : undefined,
        };
      })
    : undefined;

  return {
    id: public_id,
    company_id: String(company_public_id || _company_internal_id),
    client_id: String(client_public_id || _client_internal_id),
    created_by_user_id: String(created_by_user_public_id || _user_internal_id),
    subtotal_cents:
      subtotal_cents !== undefined ? toInt(subtotal_cents, 0) : undefined,
    discount_value_cents:
      discount_value_cents === null || discount_value_cents === undefined
        ? null
        : toInt(discount_value_cents, 0), // ← valor aplicado em centavos
    tax_amount_cents:
      tax_amount_cents === null || tax_amount_cents === undefined
        ? null
        : toInt(tax_amount_cents, 0),
    total_amount_cents:
      total_amount_cents !== undefined
        ? toInt(total_amount_cents, 0)
        : undefined,
    ...(mappedItems !== undefined ? { items: mappedItems } : {}),
    ...rest,
  };
}

/** ---------------- Serviço ---------------- */
class QuoteService {
  async _resolveCompanyId(knex, identifier) {
    const row = await knex("companies")
      .select("id")
      .where("public_id", identifier)
      .first();
    return row ? row.id : null;
  }

  async _resolveClientId(knex, identifier) {
    const row = await knex("clients")
      .select("id")
      .where("public_id", identifier)
      .first();
    return row ? row.id : null;
  }

  async _resolveQuoteId(knex, identifier) {
    const row = await knex("quotes")
      .select("id")
      .where("public_id", identifier)
      .first();
    return row ? row.id : null;
  }

  async _resolveProductId(knex, identifier) {
    const row = await knex("products")
      .select("id")
      .where("public_id", identifier)
      .first();
    return row ? row.id : null;
  }

  /**
   * Calcula totais do orçamento
   * @private
   * @param {Array} items - [{ quantity, unit_price_cents }]
   * @param {string} discountType - 'percentage' | 'fixed_amount' | null
   * @param {number} discountValue - se percentage => taxa (0–100); se fixed_amount => valor em centavos
   * @param {number} taxAmount - valor em centavos
   * @returns {{subtotal_cents:number, discount_value_cents:number, tax_amount_cents:number, total_amount_cents:number}}
   */
  _calculateTotals(items, discountType, discountValue = 0, taxAmount = 0) {
    const lineTotals = (items || []).map((it) =>
      calcLineTotalCents(it.quantity, it.unit_price_cents)
    );
    const subtotal = lineTotals.reduce((s, v) => s + v, 0);

    let discount = 0;
    if (discountType === "percentage") {
      const rate = Math.max(0, Math.min(100, toNumber(discountValue, 0))); // taxa %
      discount = Math.round(subtotal * (rate / 100));
    } else if (discountType === "fixed_amount") {
      discount = Math.max(0, toInt(discountValue, 0)); // já em centavos
    }

    // trava desconto
    discount = Math.min(discount, subtotal);

    const tax = Math.max(0, toInt(taxAmount, 0));
    const total = subtotal - discount + tax;

    return {
      subtotal_cents: subtotal,
      discount_value_cents: discount, // ← sempre valor aplicado em centavos
      tax_amount_cents: tax,
      total_amount_cents: total,
    };
  }

  /**
   * Cria um novo orçamento (aceita items vazio)
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
      discount_value_cents, // se percentage, aqui vem a TAXA; se fixed, vem centavos
      tax_amount_cents,
      currency = "BRL",
      // opcional: se existir no schema, podemos salvar a taxa
      discount_rate_percent,
    } = quoteData;

    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const clientInternalId = await this._resolveClientId(knex, client_id);

    // 1) valida cliente
    const client = await knex("clients")
      .where({ id: clientInternalId, company_id: companyInternalId })
      .first();
    if (!client) {
      const error = new Error("Cliente não encontrado nesta empresa.");
      error.statusCode = 404;
      error.code = "CLIENT_NOT_FOUND";
      throw error;
    }

    // 2) valida número duplicado
    const existingQuote = await knex("quotes")
      .where({ company_id: companyInternalId, quote_number })
      .first();
    if (existingQuote) {
      const error = new Error(
        "Já existe um orçamento com este número nesta empresa."
      );
      error.statusCode = 409;
      error.code = "QUOTE_NUMBER_CONFLICT";
      throw error;
    }

    // 3) resolve itens (pode ser vazio)
    const itemsArray = Array.isArray(items) ? items : [];
    const resolvedItems = await Promise.all(
      itemsArray.map(async (item) => {
        let productInternalId = null;
        let description = item.description;
        let unitPrice = item.unit_price_cents;

        if (item.product_id) {
          productInternalId = await this._resolveProductId(
            knex,
            item.product_id
          );
          const product = await knex("products")
            .where({ id: productInternalId, company_id: companyInternalId })
            .first();
          if (!product) {
            const err = new Error("Produto não encontrado nesta empresa.");
            err.statusCode = 404;
            err.code = "PRODUCT_NOT_FOUND";
            throw err;
          }
          if (description == null) description = product.name;
          if (unitPrice == null) unitPrice = product.unit_price_cents;
        }

        return {
          product_id: productInternalId,
          description,
          quantity: toNumber(item.quantity, 0),
          unit_price_cents: toInt(unitPrice, 0),
        };
      })
    );

    // 4) calcula totais
    const totals = this._calculateTotals(
      resolvedItems,
      discount_type,
      discount_value_cents,
      tax_amount_cents
    );

    const transaction = await knex.transaction();
    try {
      // 5) insere orçamento
      const [quote] = await transaction("quotes")
        .insert({
          company_id: companyInternalId,
          client_id: clientInternalId,
          created_by_user_id: userId,
          quote_number,
          status: "draft",
          issue_date: issue_date || new Date().toISOString().split("T")[0],
          expiry_date,
          notes,
          internal_notes,
          terms_and_conditions_content,
          discount_type: discount_type || null,
          discount_value_cents: totals.discount_value_cents, // valor aplicado
          tax_amount_cents: totals.tax_amount_cents,
          subtotal_cents: totals.subtotal_cents,
          total_amount_cents: totals.total_amount_cents,
          currency,
          // se existir coluna para taxa percentual gravamos também:
          ...(discount_type === "percentage" && discount_rate_percent == null
            ? { discount_rate_percent: toNumber(discount_value_cents, 0) }
            : discount_rate_percent != null
            ? { discount_rate_percent: toNumber(discount_rate_percent, 0) }
            : {}),
        })
        .returning("*");

      // 6) insere itens somente se houver
      if (resolvedItems.length > 0) {
        const quoteItems = resolvedItems.map((item, index) => ({
          quote_id: quote.id,
          product_id: item.product_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          total_price_cents: calcLineTotalCents(
            item.quantity,
            item.unit_price_cents
          ),
          item_order: index + 1,
        }));
        await transaction("quote_items").insert(quoteItems);
      }

      await transaction.commit();
      log.info(`Orçamento #${quote.id} criado para a empresa #${companyId}`);

      // retorna usando PUBLIC ID
      return this.getQuoteById(fastify, companyId, quote.public_id);
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
   */
  async listQuotes(fastify, companyId, queryParams = {}) {
    const { knex } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
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

    let query = knex("quotes as q")
      .leftJoin("clients as c", "q.client_id", "c.id")
      .leftJoin("users as u", "q.created_by_user_id", "u.id")
      .join("companies as comp", "q.company_id", "comp.id")
      .where("q.company_id", companyInternalId)
      .select(
        "q.*",
        "comp.public_id as company_public_id",
        "c.public_id as client_public_id",
        "u.public_id as created_by_user_public_id",
        knex.raw(`
          json_build_object(
            'id', c.public_id,
            'name', c.name,
            'email', c.email,
            'phone_number', c.phone_number,
            'document_number', c.document_number
          ) as client
        `)
      );

    let countQuery = knex("quotes")
      .where({ company_id: companyInternalId })
      .count("id as total");

    if (status) {
      query = query.where("q.status", status);
      countQuery = countQuery.where("status", status);
    }

    if (client_id) {
      const clientInternalId = await this._resolveClientId(knex, client_id);
      query = query.where("q.client_id", clientInternalId);
      countQuery = countQuery.where("client_id", clientInternalId);
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

      const quotesWithItems = await Promise.all(
        quotes.map(async (quote) => {
          const items = await knex("quote_items as qi")
            .leftJoin("products as p", "qi.product_id", "p.id")
            .where({ quote_id: quote.id })
            .select("qi.*", "p.public_id as product_public_id")
            .orderBy("qi.item_order", "asc");

          return mapQuotePublicId({ ...quote, items });
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
   */
  async getQuoteById(fastify, companyId, quoteId) {
    const { knex } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const quoteInternalId = await this._resolveQuoteId(knex, quoteId);

    const quote = await knex("quotes as q")
      .leftJoin("clients as c", "q.client_id", "c.id")
      .leftJoin("users as u", "q.created_by_user_id", "u.id")
      .join("companies as comp", "q.company_id", "comp.id")
      .where({ "q.id": quoteInternalId, "q.company_id": companyInternalId })
      .select(
        "q.*",
        "comp.public_id as company_public_id",
        "c.public_id as client_public_id",
        "u.public_id as created_by_user_public_id",
        knex.raw(`
          json_build_object(
            'id', c.public_id,
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

    const parsedQuote = {
      ...quote,
      subtotal_cents: toInt(quote.subtotal_cents, 0),
      discount_value_cents:
        quote.discount_value_cents === null
          ? null
          : toInt(quote.discount_value_cents, 0),
      tax_amount_cents:
        quote.tax_amount_cents === null
          ? null
          : toInt(quote.tax_amount_cents, 0),
      total_amount_cents: toInt(quote.total_amount_cents, 0),
    };

    const items = await knex("quote_items as qi")
      .leftJoin("products as p", "qi.product_id", "p.id")
      .where({ quote_id: quoteInternalId })
      .select("qi.*", "p.public_id as product_public_id")
      .orderBy("qi.item_order", "asc");

    return mapQuotePublicId({ ...parsedQuote, items });
  }

  /**
   * Atualiza um orçamento específico (aceita items vazio)
   */
  async updateQuote(fastify, companyId, quoteId, updateData) {
    const { knex, log } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const quoteInternalId = await this._resolveQuoteId(knex, quoteId);

    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);
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
      const quoteUpdateData = { updated_at: knex.fn.now() };

      // 🔧 Se trocar o cliente, resolve o ID interno e valida que pertence à mesma empresa
      if (updateData.client_id !== undefined) {
        const newClientInternalId = await this._resolveClientId(
          knex,
          updateData.client_id
        );
        if (!newClientInternalId) {
          const err = new Error("Cliente não encontrado.");
          err.statusCode = 404;
          err.code = "CLIENT_NOT_FOUND";
          throw err;
        }

        const belongs = await knex("clients")
          .where({ id: newClientInternalId, company_id: companyInternalId })
          .first();
        if (!belongs) {
          const err = new Error("Cliente não pertence a esta empresa.");
          err.statusCode = 403;
          err.code = "CLIENT_NOT_IN_COMPANY";
          throw err;
        }

        quoteUpdateData.client_id = newClientInternalId;
      }

      const simpleFields = [
        // ⚠️ remover "client_id" daqui para não sobrescrever com UUID por engano
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
        // se existir no schema:
        "discount_rate_percent",
      ];

      simpleFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          quoteUpdateData[field] = updateData[field];
        }
      });

      const itemsChanged = updateData.items !== undefined;
      const discountChanged = [
        "discount_type",
        "discount_value_cents",
        "tax_amount_cents",
      ].some((k) => updateData[k] !== undefined);

      // 1) resolver itens (novos ou atuais)
      let resolvedItems = [];
      if (itemsChanged) {
        const itemsArray = Array.isArray(updateData.items)
          ? updateData.items
          : [];
        resolvedItems = await Promise.all(
          itemsArray.map(async (item) => {
            let productInternalId = null;
            let description = item.description;
            let unitPrice = item.unit_price_cents;

            if (item.product_id) {
              productInternalId = await this._resolveProductId(
                knex,
                item.product_id
              );
              const product = await knex("products")
                .where({ id: productInternalId, company_id: companyInternalId })
                .first();
              if (!product) {
                const err = new Error("Produto não encontrado nesta empresa.");
                err.statusCode = 404;
                err.code = "PRODUCT_NOT_FOUND";
                throw err;
              }
              if (description == null) description = product.name;
              if (unitPrice == null) unitPrice = product.unit_price_cents;
            }

            return {
              product_id: productInternalId,
              description,
              quantity: toNumber(item.quantity, 0),
              unit_price_cents: toInt(unitPrice, 0),
            };
          })
        );
      } else {
        // usa itens atuais do banco para recalcular se preciso
        const currentItems = await knex("quote_items").where({
          quote_id: quoteInternalId,
        });
        resolvedItems = currentItems.map((it) => ({
          product_id: it.product_id,
          description: it.description,
          quantity: toNumber(it.quantity, 0),
          unit_price_cents: toInt(it.unit_price_cents, 0),
        }));
      }

      // 2) recalcula totais quando itens OU desconto/tributo mudarem
      if (itemsChanged || discountChanged) {
        const effDiscountType =
          updateData.discount_type ?? existingQuote.discount_type;
        const effDiscountValue =
          updateData.discount_value_cents ?? existingQuote.discount_value_cents;
        const effTax =
          updateData.tax_amount_cents ?? existingQuote.tax_amount_cents;

        const totals = this._calculateTotals(
          resolvedItems,
          effDiscountType,
          effDiscountValue,
          effTax
        );

        quoteUpdateData.subtotal_cents = totals.subtotal_cents;
        quoteUpdateData.discount_value_cents = totals.discount_value_cents; // valor aplicado
        quoteUpdateData.tax_amount_cents = totals.tax_amount_cents;
        quoteUpdateData.total_amount_cents = totals.total_amount_cents;

        // se existir coluna para taxa percentual e o tipo for percentage, garantimos persistir a taxa
        if (effDiscountType === "percentage") {
          const rate =
            updateData.discount_rate_percent ??
            (updateData.discount_value_cents !== undefined
              ? toNumber(updateData.discount_value_cents, 0)
              : undefined);
          if (rate !== undefined) {
            quoteUpdateData.discount_rate_percent = toNumber(rate, 0);
          }
        }
      }

      // 3) atualizar itens (remonta todos quando items veio)
      if (itemsChanged) {
        await transaction("quote_items")
          .where({ quote_id: quoteInternalId })
          .del();
        if (resolvedItems.length > 0) {
          const newItems = resolvedItems.map((item, index) => ({
            quote_id: quoteInternalId,
            product_id: item.product_id || null,
            description: item.description,
            quantity: item.quantity,
            unit_price_cents: item.unit_price_cents,
            total_price_cents: calcLineTotalCents(
              item.quantity,
              item.unit_price_cents
            ),
            item_order: index + 1,
          }));
          await transaction("quote_items").insert(newItems);
        }
      }

      await transaction("quotes")
        .where({ id: quoteInternalId, company_id: companyInternalId })
        .update(quoteUpdateData);

      await transaction.commit();
      log.info(`Orçamento #${quoteId} da empresa #${companyId} atualizado.`);
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
   */
  async updateQuoteStatus(fastify, companyId, quoteId, newStatus) {
    const { knex, log } = fastify;

    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);

    const updateData = {
      status: newStatus,
      updated_at: knex.fn.now(),
    };

    if (newStatus === "accepted" && existingQuote.status !== "accepted") {
      updateData.accepted_at = knex.fn.now();
    }

    if (newStatus === "rejected" && existingQuote.status !== "rejected") {
      updateData.rejected_at = knex.fn.now();
    }

    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const quoteInternalId = await this._resolveQuoteId(knex, quoteId);

    try {
      await knex("quotes")
        .where({ id: quoteInternalId, company_id: companyInternalId })
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
   */
  async deleteQuote(fastify, companyId, quoteId) {
    const { knex, log } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const quoteInternalId = await this._resolveQuoteId(knex, quoteId);

    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);
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
      await transaction("quote_items")
        .where({ quote_id: quoteInternalId })
        .del();

      const result = await transaction("quotes")
        .where({ id: quoteInternalId, company_id: companyInternalId })
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
   */
  async getQuoteCount(fastify, companyId, period = "month") {
    const { knex } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);

    let query = knex("quotes").where({ company_id: companyInternalId });

    if (period === "month") {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      query = query.where("created_at", ">=", startOfMonth.toISOString());
    } else if (period === "year") {
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
   */
  async generateQuoteNumber(fastify, companyId) {
    const { knex } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);

    const lastQuote = await knex("quotes")
      .where({ company_id: companyInternalId })
      .orderBy("id", "desc")
      .first();

    const currentYear = new Date().getFullYear();

    if (!lastQuote) {
      return `${currentYear}-001`;
    }

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

    return `${currentYear}-001`;
  }

  /**
   * Busca orçamentos próximos ao vencimento
   */
  async getExpiringQuotes(fastify, companyId, daysAhead = 7) {
    const { knex } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const results = await knex("quotes as q")
      .leftJoin("clients as c", "q.client_id", "c.id")
      .leftJoin("users as u", "q.created_by_user_id", "u.id")
      .join("companies as comp", "q.company_id", "comp.id")
      .where("q.company_id", companyInternalId)
      .where("q.status", "sent")
      .where("q.expiry_date", "<=", futureDate.toISOString().split("T")[0])
      .where("q.expiry_date", ">=", new Date().toISOString().split("T")[0])
      .select(
        "q.*",
        "comp.public_id as company_public_id",
        "c.public_id as client_public_id",
        "u.public_id as created_by_user_public_id",
        "c.name as client_name",
        "c.email as client_email"
      )
      .orderBy("q.expiry_date", "asc");

    return results.map(mapQuotePublicId);
  }

  /**
   * Adiciona 1 item no orçamento e recalcula totais
   */
  async addQuoteItem(fastify, companyId, quoteId, payload) {
    const { knex, log } = fastify;

    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const quoteInternalId = await this._resolveQuoteId(knex, quoteId);

    // valida orçamento e empresa
    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);
    if (["accepted", "invoiced"].includes(existingQuote.status)) {
      const e = new Error(
        "Orçamentos aceitos ou faturados não podem ser editados."
      );
      e.statusCode = 422;
      e.code = "QUOTE_NOT_EDITABLE";
      throw e;
    }

    // resolve produto (opcional)
    let productInternalId = null;
    let description = payload.description;
    let unitPriceCents = payload.unit_price_cents;

    if (payload.product_id) {
      productInternalId = await this._resolveProductId(
        knex,
        payload.product_id
      );
      const product = await knex("products")
        .where({
          id: productInternalId,
          company_id: await this._resolveCompanyId(knex, companyId),
        })
        .first();
      if (!product) {
        const err = new Error("Produto não encontrado nesta empresa.");
        err.statusCode = 404;
        err.code = "PRODUCT_NOT_FOUND";
        throw err;
      }
      if (description == null) description = product.name;
      if (unitPriceCents == null) unitPriceCents = product.unit_price_cents;
    }

    const transaction = await knex.transaction();
    try {
      // descobrir próxima ordem
      const { max_order } = await transaction("quote_items")
        .where({ quote_id: quoteInternalId })
        .max({ max_order: "item_order" })
        .first();
      const nextOrder = (max_order || 0) + 1;

      // inserir item
      const qty = Number(payload.quantity) || 0;
      const unit = Math.round(Number(unitPriceCents) || 0);
      const lineTotal = Math.round(qty * unit);

      await transaction("quote_items").insert({
        quote_id: quoteInternalId,
        product_id: productInternalId || null,
        description,
        quantity: qty,
        unit_price_cents: unit,
        total_price_cents: lineTotal,
        item_order: nextOrder,
      });

      // recarregar itens e recalcular totais
      const itemsDb = await transaction("quote_items")
        .where({ quote_id: quoteInternalId })
        .orderBy("item_order", "asc");
      const itemsForCalc = itemsDb.map((it) => ({
        quantity: Number(it.quantity) || 0,
        unit_price_cents: Math.round(Number(it.unit_price_cents) || 0),
      }));
      const totals = this._calculateTotals(
        itemsForCalc,
        existingQuote.discount_type,
        existingQuote.discount_value_cents, // obs: aqui é taxa quando percentage
        existingQuote.tax_amount_cents
      );

      await transaction("quotes")
        .where({ id: quoteInternalId, company_id: companyInternalId })
        .update({
          subtotal_cents: totals.subtotal_cents,
          discount_value_cents: totals.discount_value_cents,
          tax_amount_cents: totals.tax_amount_cents,
          total_amount_cents: totals.total_amount_cents,
          updated_at: knex.fn.now(),
        });

      await transaction.commit();
      log.info(`Item adicionado ao orçamento ${quoteId}`);
      return this.getQuoteById(fastify, companyId, quoteId);
    } catch (err) {
      await transaction.rollback();
      throw err.statusCode
        ? err
        : new Error("Não foi possível adicionar o item.");
    }
  }

  /**
   * Atualiza 1 item do orçamento e recalcula totais
   */
  async updateQuoteItem(fastify, companyId, quoteId, itemId, payload) {
    const { knex, log } = fastify;

    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const quoteInternalId = await this._resolveQuoteId(knex, quoteId);

    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);
    if (["accepted", "invoiced"].includes(existingQuote.status)) {
      const e = new Error(
        "Orçamentos aceitos ou faturados não podem ser editados."
      );
      e.statusCode = 422;
      e.code = "QUOTE_NOT_EDITABLE";
      throw e;
    }

    // valida que o item pertence ao orçamento
    const currentItem = await knex("quote_items")
      .where({ id: itemId, quote_id: quoteInternalId })
      .first();
    if (!currentItem) {
      const e = new Error("Item não encontrado neste orçamento.");
      e.statusCode = 404;
      e.code = "QUOTE_ITEM_NOT_FOUND";
      throw e;
    }

    // resolver produto opcional
    let productInternalId = currentItem.product_id;
    let description = payload.description ?? currentItem.description;
    let unitPriceCents =
      payload.unit_price_cents ?? currentItem.unit_price_cents;

    if (payload.product_id !== undefined) {
      if (payload.product_id === null) {
        productInternalId = null;
      } else {
        const pid = await this._resolveProductId(knex, payload.product_id);
        const product = await knex("products")
          .where({ id: pid, company_id: companyInternalId })
          .first();
        if (!product) {
          const err = new Error("Produto não encontrado nesta empresa.");
          err.statusCode = 404;
          err.code = "PRODUCT_NOT_FOUND";
          throw err;
        }
        productInternalId = pid;
        if (payload.description == null && !description)
          description = product.name;
        if (payload.unit_price_cents == null && unitPriceCents == null)
          unitPriceCents = product.unit_price_cents;
      }
    }

    const qty =
      payload.quantity !== undefined
        ? Number(payload.quantity)
        : Number(currentItem.quantity);
    const unit =
      payload.unit_price_cents !== undefined
        ? Math.round(Number(payload.unit_price_cents))
        : Math.round(Number(unitPriceCents));
    const lineTotal = Math.round(
      (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unit) ? unit : 0)
    );

    const transaction = await knex.transaction();
    try {
      await transaction("quote_items")
        .where({ id: itemId, quote_id: quoteInternalId })
        .update({
          product_id: productInternalId,
          description,
          quantity: qty,
          unit_price_cents: unit,
          total_price_cents: lineTotal,
          updated_at: knex.fn.now(),
        });

      const itemsDb = await transaction("quote_items")
        .where({ quote_id: quoteInternalId })
        .orderBy("item_order", "asc");
      const itemsForCalc = itemsDb.map((it) => ({
        quantity: Number(it.quantity) || 0,
        unit_price_cents: Math.round(Number(it.unit_price_cents) || 0),
      }));
      const totals = this._calculateTotals(
        itemsForCalc,
        existingQuote.discount_type,
        existingQuote.discount_value_cents,
        existingQuote.tax_amount_cents
      );

      await transaction("quotes")
        .where({ id: quoteInternalId, company_id: companyInternalId })
        .update({
          subtotal_cents: totals.subtotal_cents,
          discount_value_cents: totals.discount_value_cents,
          tax_amount_cents: totals.tax_amount_cents,
          total_amount_cents: totals.total_amount_cents,
          updated_at: knex.fn.now(),
        });

      await transaction.commit();
      log.info(`Item ${itemId} atualizado no orçamento ${quoteId}`);
      return this.getQuoteById(fastify, companyId, quoteId);
    } catch (err) {
      await transaction.rollback();
      throw err.statusCode
        ? err
        : new Error("Não foi possível atualizar o item.");
    }
  }

  /**
   * Remove 1 item do orçamento, reordena e recalcula totais
   */
  async deleteQuoteItem(fastify, companyId, quoteId, itemId) {
    const { knex, log } = fastify;

    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const quoteInternalId = await this._resolveQuoteId(knex, quoteId);

    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);
    if (["accepted", "invoiced"].includes(existingQuote.status)) {
      const e = new Error(
        "Orçamentos aceitos ou faturados não podem ser editados."
      );
      e.statusCode = 422;
      e.code = "QUOTE_NOT_EDITABLE";
      throw e;
    }

    const transaction = await knex.transaction();
    try {
      const item = await transaction("quote_items")
        .where({ id: itemId, quote_id: quoteInternalId })
        .first();
      if (!item) {
        const e = new Error("Item não encontrado neste orçamento.");
        e.statusCode = 404;
        e.code = "QUOTE_ITEM_NOT_FOUND";
        throw e;
      }

      await transaction("quote_items")
        .where({ id: itemId, quote_id: quoteInternalId })
        .del();

      // reordenar sequencialmente
      const itemsDb = await transaction("quote_items")
        .where({ quote_id: quoteInternalId })
        .orderBy("item_order", "asc");

      for (let i = 0; i < itemsDb.length; i++) {
        const it = itemsDb[i];
        if (it.item_order !== i + 1) {
          await transaction("quote_items")
            .where({ id: it.id })
            .update({ item_order: i + 1 });
        }
      }

      // recalcular totais
      const itemsForCalc = itemsDb.map((it) => ({
        quantity: Number(it.quantity) || 0,
        unit_price_cents: Math.round(Number(it.unit_price_cents) || 0),
      }));
      const totals = this._calculateTotals(
        itemsForCalc,
        existingQuote.discount_type,
        existingQuote.discount_value_cents,
        existingQuote.tax_amount_cents
      );

      await transaction("quotes")
        .where({ id: quoteInternalId, company_id: companyInternalId })
        .update({
          subtotal_cents: totals.subtotal_cents,
          discount_value_cents: totals.discount_value_cents,
          tax_amount_cents: totals.tax_amount_cents,
          total_amount_cents: totals.total_amount_cents,
          updated_at: knex.fn.now(),
        });

      await transaction.commit();
      log.info(`Item ${itemId} removido do orçamento ${quoteId}`);
      return this.getQuoteById(fastify, companyId, quoteId);
    } catch (err) {
      await transaction.rollback();
      throw err.statusCode
        ? err
        : new Error("Não foi possível remover o item.");
    }
  }

  /**
   * Estatísticas de orçamentos
   */
  async getQuoteStats(fastify, companyId) {
    const { knex } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);

    const stats = await knex("quotes")
      .where({ company_id: companyInternalId })
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
