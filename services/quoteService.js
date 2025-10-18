"use strict";

const permissionService = require("./permissionService");

/** ---------------- Helpers numéricos e arredondamento ---------------- */
const toNumber = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const toInt = (v, def = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : def;
};

const parseImagesArray = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (Array.isArray(value)) {
    return value.filter((url) => typeof url === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((url) => typeof url === "string")
        : [];
    } catch (error) {
      return [];
    }
  }
  return [];
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
    created_by_user_name,
    company_id: _company_internal_id,
    client_id: _client_internal_id,
    created_by_user_id: _user_internal_id,
    items,
    subtotal_cents,
    discount_value_cents,
    tax_amount_cents,
    total_amount_cents,
    ...rest
  } = quote;

  const resolvedCreatorId =
    created_by_user_public_id ?? _user_internal_id ?? null;

  const mappedItems = Array.isArray(items)
    ? items.map((it) => {
        const {
          product_public_id,
          product_id: _product_internal_id,
          unit_price_cents,
          total_price_cents,
          quantity,
          ...itemRest
        } = it;
        const parsedImages = parseImagesArray(it.images);
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
          complement: it.complement,
          images:
            parsedImages === undefined ? undefined : parsedImages,
        };
      })
    : undefined;

  return {
    id: public_id,
    company_id: String(company_public_id || _company_internal_id),
    client_id: String(client_public_id || _client_internal_id),
    created_by_user_id:
      resolvedCreatorId !== null ? String(resolvedCreatorId) : null,
    created_by_user_name: created_by_user_name ?? null,
    subtotal_cents:
      subtotal_cents !== undefined ? toInt(subtotal_cents, 0) : undefined,
    discount_value_cents:
      discount_value_cents === null || discount_value_cents === undefined
        ? null
        : toInt(discount_value_cents, 0),
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

  async _ensureQuoteEditPermissions(knex, companyId, quoteId, userId) {
    const company = await knex("companies")
      .select("id", "owner_id")
      .where("public_id", companyId)
      .first();

    if (!company) {
      const error = new Error("Empresa não encontrada.");
      error.statusCode = 404;
      error.code = "COMPANY_NOT_FOUND";
      throw error;
    }

    const quote = await knex("quotes")
      .select("id", "created_by_user_id")
      .where({ company_id: company.id })
      .where("public_id", quoteId)
      .first();

    if (!quote) {
      const error = new Error("Orçamento não encontrado.");
      error.statusCode = 404;
      error.code = "QUOTE_NOT_FOUND";
      throw error;
    }

    const isOwner = company.owner_id === userId;

    if (!isOwner && quote.created_by_user_id !== userId) {
      const error = new Error(
        "Você não tem permissão para editar este orçamento."
      );
      error.statusCode = 403;
      error.code = "QUOTE_EDIT_FORBIDDEN";
      throw error;
    }

    return {
      companyInternalId: company.id,
      quoteInternalId: quote.id,
      isOwner,
      quoteCreatorId: quote.created_by_user_id,
    };
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
      const rate = Math.max(0, Math.min(100, toNumber(discountValue, 0)));
      discount = Math.round(subtotal * (rate / 100));
    } else if (discountType === "fixed_amount") {
      discount = Math.max(0, toInt(discountValue, 0));
    }

    discount = Math.min(discount, subtotal);
    // Allow taxAmount to be 0, but prevent negative values
    const tax = toInt(taxAmount, 0) < 0 ? 0 : toInt(taxAmount, 0);
    const total = subtotal - discount + tax;

    return {
      subtotal_cents: subtotal,
      discount_value_cents: discount,
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
      discount_value_cents,
      tax_amount_cents,
      currency = "BRL",
    } = quoteData;

    // Validate discount_value_cents for percentage discounts
    if (discount_type === "percentage" && discount_value_cents !== undefined) {
      const rate = toNumber(discount_value_cents, 0);
      if (rate < 0 || rate > 100) {
        const error = new Error(
          "Taxa de desconto deve ser entre 0 e 100 para descontos percentuais."
        );
        error.statusCode = 400;
        error.code = "INVALID_DISCOUNT_RATE";
        throw error;
      }
    }

    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    if (!companyInternalId) {
      const error = new Error("Empresa não encontrada.");
      error.statusCode = 404;
      error.code = "COMPANY_NOT_FOUND";
      throw error;
    }

    const clientInternalId = await this._resolveClientId(knex, client_id);
    if (!clientInternalId) {
      const error = new Error("Cliente não encontrado.");
      error.statusCode = 404;
      error.code = "CLIENT_NOT_FOUND";
      throw error;
    }

    const client = await knex("clients")
      .where({ id: clientInternalId, company_id: companyInternalId })
      .first();
    if (!client) {
      const error = new Error("Cliente não encontrado nesta empresa.");
      error.statusCode = 404;
      error.code = "CLIENT_NOT_FOUND";
      throw error;
    }

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

        if (item.images && item.images.length > 0) {
          const userPlan = await permissionService.getUserPlan(fastify, userId);
          if (!permissionService.checkPermission(userPlan, "allow_images")) {
            const err = new Error(
              "Seu plano não permite adicionar imagens aos itens."
            );
            err.statusCode = 403;
            err.code = "IMAGES_NOT_ALLOWED";
            throw err;
          }
        }
        return {
          product_id: productInternalId,
          description,
          quantity: toNumber(item.quantity, 0),
          unit_price_cents: toInt(unitPrice, 0),
          complement: item.complement,
          images: item.images,
        };
      })
    );

    const totals = this._calculateTotals(
      resolvedItems,
      discount_type,
      discount_value_cents,
      tax_amount_cents
    );

    const transaction = await knex.transaction();
    try {
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
          discount_value_cents: totals.discount_value_cents,
          tax_amount_cents: totals.tax_amount_cents,
          subtotal_cents: totals.subtotal_cents,
          total_amount_cents: totals.total_amount_cents,
          currency,
        })
        .returning("*");

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
          complement: item.complement,
          images: JSON.stringify(item.images || []),
        }));
        await transaction("quote_items").insert(quoteItems);
      }

      await transaction.commit();
      log.info(`Orçamento #${quote.id} criado para a empresa #${companyId}`);
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
      throw error.statusCode
        ? error
        : new Error("Não foi possível criar o orçamento.");
    }
  }

  /**
   * Atualiza um orçamento específico (aceita items vazio)
   */
  async updateQuote(fastify, companyId, quoteId, userId, updateData) {
    const { knex, log } = fastify;
    const { companyInternalId, quoteInternalId } =
      await this._ensureQuoteEditPermissions(knex, companyId, quoteId, userId);

    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);
    if (["accepted", "invoiced"].includes(existingQuote.status)) {
      const error = new Error(
        "Orçamentos aceitos ou faturados não podem ser editados."
      );
      error.statusCode = 422;
      error.code = "QUOTE_NOT_EDITABLE";
      throw error;
    }

    // Validate discount_value_cents for percentage discounts
    if (
      updateData.discount_type === "percentage" &&
      updateData.discount_value_cents !== undefined
    ) {
      const rate = toNumber(updateData.discount_value_cents, 0);
      if (rate < 0 || rate > 100) {
        const error = new Error(
          "Taxa de desconto deve ser entre 0 e 100 para descontos percentuais."
        );
        error.statusCode = 400;
        error.code = "INVALID_DISCOUNT_RATE";
        throw error;
      }
    }

    const trx = await knex.transaction();
    try {
      const quoteUpdateData = { updated_at: knex.fn.now() };

      if (updateData.client_id !== undefined) {
        const clientInternalId = await this._resolveClientId(
          knex,
          updateData.client_id
        );
        if (!clientInternalId) {
          const err = new Error("Cliente não encontrado.");
          err.statusCode = 404;
          err.code = "CLIENT_NOT_FOUND";
          throw err;
        }
        const client = await trx("clients")
          .where({ id: clientInternalId, company_id: companyInternalId })
          .first();
        if (!client) {
          const err = new Error("Cliente não pertence a esta empresa.");
          err.statusCode = 404;
          err.code = "CLIENT_NOT_FOUND";
          throw err;
        }
        quoteUpdateData.client_id = clientInternalId;
      }

      const simpleFields = [
        "quote_number",
        "status",
        "issue_date",
        "expiry_date",
        "notes",
        "internal_notes",
        "terms_and_conditions_content",
        "discount_type",
        "tax_amount_cents",
        "currency",
      ];
      simpleFields.forEach((f) => {
        if (updateData[f] !== undefined) quoteUpdateData[f] = updateData[f];
      });

      const dbItems = await trx("quote_items")
        .where({ quote_id: quoteInternalId })
        .orderBy("item_order", "asc");

      const itemsForCalc = dbItems.map((it) => ({
        quantity: toNumber(it.quantity, 0),
        unit_price_cents: toInt(it.unit_price_cents, 0),
      }));

      const discountType =
        updateData.discount_type ?? existingQuote.discount_type ?? null;
      const discountInput =
        updateData.discount_value_cents ??
        existingQuote.discount_value_cents ??
        0;
      const taxAmount =
        updateData.tax_amount_cents ?? existingQuote.tax_amount_cents ?? 0;

      const totals = this._calculateTotals(
        itemsForCalc,
        discountType,
        discountInput,
        taxAmount
      );

      quoteUpdateData.subtotal_cents = totals.subtotal_cents;
      quoteUpdateData.discount_value_cents = totals.discount_value_cents;
      quoteUpdateData.tax_amount_cents = totals.tax_amount_cents;
      quoteUpdateData.total_amount_cents = totals.total_amount_cents;

      await trx("quotes")
        .where({ id: quoteInternalId, company_id: companyInternalId })
        .update(quoteUpdateData);

      await trx.commit();
      log.info(`Orçamento #${quoteId} da empresa #${companyId} atualizado.`);
      return this.getQuoteById(fastify, companyId, quoteId);
    } catch (err) {
      await trx.rollback();
      log.error(err, `Erro ao atualizar orçamento #${quoteId}`);
      if (err.code === "23505") {
        const e = new Error(
          "O número do orçamento fornecido já pertence a outro orçamento desta empresa."
        );
        e.statusCode = 409;
        e.code = "QUOTE_NUMBER_CONFLICT";
        throw e;
      }
      throw err.statusCode
        ? err
        : new Error("Não foi possível atualizar o orçamento.");
    }
  }

  /**
   * Adiciona 1 item no orçamento e recalcula totais
   */
  async addQuoteItem(fastify, companyId, quoteId, userId, payload) {
    const { knex, log } = fastify;
    const { companyInternalId, quoteInternalId } =
      await this._ensureQuoteEditPermissions(knex, companyId, quoteId, userId);

    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);
    if (["accepted", "invoiced"].includes(existingQuote.status)) {
      const e = new Error(
        "Orçamentos aceitos ou faturados não podem ser editados."
      );
      e.statusCode = 422;
      e.code = "QUOTE_NOT_EDITABLE";
      throw e;
    }

    // Verifica a permissão para adicionar imagens
    if (payload.images && payload.images.length > 0) {
      const userPlan = await permissionService.getUserPlan(fastify, userId);
      if (!permissionService.checkPermission(userPlan, "allow_images")) {
        const err = new Error(
          "O seu plano atual não permite adicionar imagens aos itens do orçamento."
        );
        err.statusCode = 403;
        err.code = "FEATURE_NOT_ALLOWED_IMAGES";
        throw err;
      }
    }

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
          company_id: companyInternalId,
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
      const { max_order } = await transaction("quote_items")
        .where({ quote_id: quoteInternalId })
        .max({ max_order: "item_order" })
        .first();
      const nextOrder = (max_order || 0) + 1;

      const qty = toNumber(payload.quantity, 0);
      const unit = toInt(unitPriceCents, 0);
      const lineTotal = calcLineTotalCents(qty, unit);

      await transaction("quote_items").insert({
        quote_id: quoteInternalId,
        product_id: productInternalId || null,
        description,
        quantity: qty,
        unit_price_cents: unit,
        total_price_cents: lineTotal,
        item_order: nextOrder,
        complement: payload.complement,
        images: JSON.stringify(payload.images || []),
      });

      const itemsDb = await transaction("quote_items")
        .where({ quote_id: quoteInternalId })
        .orderBy("item_order", "asc");
      const itemsForCalc = itemsDb.map((it) => ({
        quantity: toNumber(it.quantity, 0),
        unit_price_cents: toInt(it.unit_price_cents, 0),
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
  async updateQuoteItem(
    fastify,
    companyId,
    quoteId,
    userId,
    itemId,
    payload
  ) {
    const { knex, log } = fastify;
    const { companyInternalId, quoteInternalId } =
      await this._ensureQuoteEditPermissions(knex, companyId, quoteId, userId);

    const existingQuote = await this.getQuoteById(fastify, companyId, quoteId);
    if (["accepted", "invoiced"].includes(existingQuote.status)) {
      const e = new Error(
        "Orçamentos aceitos ou faturados não podem ser editados."
      );
      e.statusCode = 422;
      e.code = "QUOTE_NOT_EDITABLE";
      throw e;
    }

    const currentItem = await knex("quote_items")
      .where({ id: itemId, quote_id: quoteInternalId })
      .first();
    if (!currentItem) {
      const e = new Error("Item não encontrado neste orçamento.");
      e.statusCode = 404;
      e.code = "QUOTE_ITEM_NOT_FOUND";
      throw e;
    }

    let productInternalId = currentItem.product_id;
    let description = payload.description ?? currentItem.description;
    let unitPriceCents =
      payload.unit_price_cents ?? currentItem.unit_price_cents;

    if (payload.product_id !== undefined) {
      if (payload.product_id === null || payload.product_id === "null") {
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
        if (description == null) description = product.name;
        if (unitPriceCents == null) unitPriceCents = product.unit_price_cents;
      }
    }

    const qty =
      payload.quantity !== undefined
        ? toNumber(payload.quantity, 0)
        : toNumber(currentItem.quantity, 0);
    const unit =
      payload.unit_price_cents !== undefined
        ? toInt(payload.unit_price_cents, 0)
        : toInt(unitPriceCents, 0);
    const lineTotal = calcLineTotalCents(qty, unit);

    let imagesToPersist;
    if (payload.images !== undefined) {
      const requestedImages = parseImagesArray(payload.images) || [];
      if (requestedImages.length > 0) {
        const userPlan = await permissionService.getUserPlan(fastify, userId);
        if (!permissionService.checkPermission(userPlan, "allow_images")) {
          const err = new Error(
            "O seu plano atual não permite adicionar imagens aos itens do orçamento."
          );
          err.statusCode = 403;
          err.code = "FEATURE_NOT_ALLOWED_IMAGES";
          throw err;
        }
      }
      imagesToPersist = requestedImages;
    } else {
      const currentImages = parseImagesArray(currentItem.images);
      imagesToPersist = currentImages === undefined ? [] : currentImages;
    }

    const complement =
      payload.complement === undefined
        ? currentItem.complement
        : payload.complement;

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
          complement,
          images: JSON.stringify(imagesToPersist ?? []),
        });

      const itemsDb = await transaction("quote_items")
        .where({ quote_id: quoteInternalId })
        .orderBy("item_order", "asc");
      const itemsForCalc = itemsDb.map((it) => ({
        quantity: toNumber(it.quantity, 0),
        unit_price_cents: toInt(it.unit_price_cents, 0),
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
  async deleteQuoteItem(fastify, companyId, quoteId, userId, itemId) {
    const { knex, log } = fastify;
    const { companyInternalId, quoteInternalId } =
      await this._ensureQuoteEditPermissions(knex, companyId, quoteId, userId);

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

      const itemsForCalc = itemsDb.map((it) => ({
        quantity: toNumber(it.quantity, 0),
        unit_price_cents: toInt(it.unit_price_cents, 0),
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
        "u.name as created_by_user_name",
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
   * Retorna dados essenciais do orçamento para geração de PDF
   */
  async getQuotePdfData(fastify, companyId, quoteId) {
    const { knex } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const quoteInternalId = await this._resolveQuoteId(knex, quoteId);

    const quote = await knex("quotes as q")
      .leftJoin("clients as c", "q.client_id", "c.id")
      .join("companies as comp", "q.company_id", "comp.id")
      .where({ "q.id": quoteInternalId, "q.company_id": companyInternalId })
      .select(
        "q.quote_number",
        "q.expiry_date",
        "q.status",
        "q.notes",
        "q.terms_and_conditions_content",
        "q.discount_type",
        "q.discount_value_cents",
        "q.subtotal_cents",
        "comp.name as company_name",
        "comp.document_number as company_document",
        "comp.address_street",
        "comp.address_number",
        "comp.address_city",
        "comp.address_state",
        "comp.address_zip_code",
        "comp.phone_number as company_phone",
        "comp.email as company_email",
        "comp.logo_url",
        "c.name as client_name",
        "c.phone_number as client_phone"
      )
      .first();

    if (!quote) {
      const error = new Error("Orçamento não encontrado nesta empresa.");
      error.statusCode = 404;
      error.code = "QUOTE_NOT_FOUND";
      throw error;
    }

    const items = await knex("quote_items")
      .where({ quote_id: quoteInternalId })
      .select(
        "description",
        "quantity",
        "unit_price_cents",
        "complement",
        "images"
      )
      .orderBy("item_order", "asc");

    const addressParts = [
      quote.address_street &&
        [quote.address_street, quote.address_number].filter(Boolean).join(", "),
      [quote.address_city, quote.address_state, quote.address_zip_code]
        .filter(Boolean)
        .join(", "),
    ].filter(Boolean);
    const companyAddress = addressParts.join(" - ");

    const formattedItems = items.map((item) => {
      let parsedImages = item.images;

      if (typeof parsedImages === "string") {
        try {
          parsedImages = JSON.parse(parsedImages);
        } catch (error) {
          parsedImages = [];
        }
      }

      return {
        description: item.description,
        quantity: toNumber(item.quantity, 0),
        unitPrice: toInt(item.unit_price_cents, 0) / 100,
        complement: item.complement || null,
        images: Array.isArray(parsedImages) ? parsedImages : [],
      };
    });

    const discount = quote.discount_value_cents
      ? toInt(quote.discount_value_cents, 0) / 100
      : 0;

    let discountInputValue;
    if (quote.discount_type === "percentage") {
      const subtotal = toInt(quote.subtotal_cents, 0);
      const discountAmount = toInt(quote.discount_value_cents, 0);
      if (subtotal > 0 && discountAmount > 0) {
        discountInputValue = Math.round((discountAmount / subtotal) * 100);
      } else {
        discountInputValue = 0;
      }
    } else if (quote.discount_type === "fixed_amount") {
      discountInputValue = toInt(quote.discount_value_cents, 0) / 100;
    } else {
      discountInputValue = 0;
    }

    return {
      title: `Orçamento ${quote.quote_number}`,
      data: {
        logo: { url: quote.logo_url },
        watermark: {
          type: "logo",
          logo: { url: quote.logo_url },
        },
        budget: {
          number: quote.quote_number,
          validUntil: quote.expiry_date,
          status: quote.status,
          company: {
            name: quote.company_name,
            cnpj: quote.company_document,
            address: companyAddress,
            phone: quote.company_phone,
            email: quote.company_email,
          },
          client: {
            name: quote.client_name,
            phone: quote.client_phone,
          },
          items: formattedItems,
          discount,
          discount_type: quote.discount_type,
          discount_value: discountInputValue,
          notes: quote.notes,
          terms: quote.terms_and_conditions_content,
        },
      },
    };
  }

  /**
   * Lista orçamentos de uma empresa com paginação e filtros
   */
  async listQuotes(fastify, companyId, queryParams = {}) {
    const { knex } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    if (!companyInternalId) {
      return {
        data: [],
        pagination: {
          totalItems: 0,
          totalPages: 0,
          currentPage: 1,
          pageSize: 10,
        },
      };
    }
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
        "u.name as created_by_user_name",
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
      query = query.where("q.quote_number", "ilike", `%${quote_number}%`);
      countQuery = countQuery.where(
        "quote_number",
        "ilike",
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
   * Atualiza apenas o status de um orçamento
   */
  async updateQuoteStatus(fastify, companyId, quoteId, userId, newStatus) {
    const { knex, log } = fastify;

    const { companyInternalId, quoteInternalId } =
      await this._ensureQuoteEditPermissions(knex, companyId, quoteId, userId);

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
  async deleteQuote(fastify, companyId, quoteId, userId) {
    const { knex, log } = fastify;
    const { companyInternalId, quoteInternalId } =
      await this._ensureQuoteEditPermissions(knex, companyId, quoteId, userId);

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
      throw error.statusCode
        ? error
        : new Error("Não foi possível excluir o orçamento.");
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
        "u.name as created_by_user_name",
        "c.name as client_name",
        "c.email as client_email"
      )
      .orderBy("q.expiry_date", "asc");

    return results.map(mapQuotePublicId);
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
      total_accepted_value_cents: parseInt(stats.total_accepted_value ?? 0, 10),
      avg_accepted_value_cents: Math.round(
        parseFloat(stats.avg_accepted_value ?? 0)
      ),
      acceptance_rate: acceptanceRate,
    };
  }
}

module.exports = new QuoteService();
