"use strict";

function mapProductPublicId(product) {
  if (!product) return null;
  const {
    id: _ignored,
    public_id,
    company_public_id,
    company_id: _company_internal_id,
    ...rest
  } = product;
  return {
    id: public_id,
    company_id: String(company_public_id || _company_internal_id),
    ...rest,
  };
}

class ProductService {
  async _resolveCompanyId(knex, identifier) {
    const row = await knex("companies")
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
   * Cria um novo produto para uma empresa
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {object} productData
   * @returns {Promise<object>}
   */
  async createProduct(fastify, companyId, productData) {
    const { knex, log } = fastify;
    const { sku } = productData;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);

    // Verifica se já existe um produto com o mesmo SKU na empresa (se SKU foi fornecido)
    if (sku) {
      const existingProduct = await knex("products")
        .where({
          company_id: companyInternalId,
          sku: sku,
        })
        .first();

      if (existingProduct) {
        const error = new Error(
          "Já existe um produto com este SKU nesta empresa."
        );
        error.statusCode = 409;
        error.code = "PRODUCT_SKU_CONFLICT";
        throw error;
      }
    }

    try {
      const [product] = await knex("products")
        .insert({
          ...productData,
          company_id: companyInternalId,
        })
        .returning("*");

      log.info(`Produto #${product.id} criado para a empresa #${companyId}`);
      return this.getProductById(fastify, companyId, product.public_id);
    } catch (error) {
      log.error(error, `Erro ao criar produto para a empresa #${companyId}`);

      // Tratamento do erro de violação de unicidade do PostgreSQL
      if (error.code === "23505") {
        const customError = new Error(
          "Já existe um produto com este SKU nesta empresa."
        );
        customError.statusCode = 409;
        customError.code = "PRODUCT_SKU_CONFLICT";
        throw customError;
      }

      throw new Error("Não foi possível criar o produto.");
    }
  }

  /**
   * Lista produtos de uma empresa com paginação e filtros
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {object} queryParams
   * @returns {Promise<object>}
   */
  async listProducts(fastify, companyId, queryParams = {}) {
    const { knex } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const { page = 1, pageSize = 10, name, sku, is_active, unit } = queryParams;

    const offset = (page - 1) * pageSize;

    // Query principal para buscar produtos
    let query = knex("products as p")
      .join("companies as c", "p.company_id", "c.id")
      .where("p.company_id", companyInternalId)
      .select("p.*", "c.public_id as company_public_id");

    // Query para contar total de itens
    let countQuery = knex("products")
      .where({ company_id: companyInternalId })
      .count("id as total");

    // Aplicar filtros se fornecidos
    if (name) {
      const nameFilter = `%${name}%`;
      query = query.where("p.name", "like", nameFilter);
      countQuery = countQuery.where("name", "like", nameFilter);
    }

    if (sku) {
      query = query.where("p.sku", sku);
      countQuery = countQuery.where("sku", sku);
    }

    if (typeof is_active === "boolean") {
      query = query.where("p.is_active", is_active);
      countQuery = countQuery.where("is_active", is_active);
    }

    if (unit) {
      query = query.where("p.unit", unit);
      countQuery = countQuery.where("unit", unit);
    }

    try {
      // Executa as queries
      const products = await query
        .orderBy("p.name", "asc")
        .limit(pageSize)
        .offset(offset);

      const [{ total: totalItems }] = await countQuery;
      const totalPages = Math.ceil(totalItems / pageSize);

      return {
        data: products.map(mapProductPublicId),
        pagination: {
          totalItems: parseInt(totalItems),
          totalPages,
          currentPage: parseInt(page),
          pageSize: parseInt(pageSize),
        },
      };
    } catch (error) {
      fastify.log.error(error, "Erro ao listar produtos");
      throw new Error("Não foi possível listar os produtos.");
    }
  }

  /**
   * Busca um produto específico por ID
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {number} productId
   * @returns {Promise<object>}
   */
  async getProductById(fastify, companyId, productId) {
    const companyInternalId = await this._resolveCompanyId(
      fastify.knex,
      companyId
    );
    const productInternalId = await this._resolveProductId(
      fastify.knex,
      productId
    );

    const product = await fastify
      .knex("products as p")
      .join("companies as c", "p.company_id", "c.id")
      .where({
        "p.id": productInternalId,
        "p.company_id": companyInternalId,
      })
      .select("p.*", "c.public_id as company_public_id")
      .first();

    if (!product) {
      const error = new Error("Produto não encontrado nesta empresa.");
      error.statusCode = 404;
      error.code = "PRODUCT_NOT_FOUND";
      throw error;
    }

    return mapProductPublicId(product);
  }

  /**
   * Atualiza um produto específico
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {number} productId
   * @param {object} updateData
   * @returns {Promise<object>}
   */
  async updateProduct(fastify, companyId, productId, updateData) {
    const { knex, log } = fastify;
    const { sku } = updateData;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const productInternalId = await this._resolveProductId(knex, productId);

    // Verifica se o produto existe
    await this.getProductById(fastify, companyId, productId);

    // Se SKU foi fornecido, verifica se não conflita com outro produto
    if (sku) {
      const existingProduct = await knex("products")
        .where({
          company_id: companyInternalId,
          sku: sku,
        })
        .whereNot({ id: productInternalId })
        .first();

      if (existingProduct) {
        const error = new Error(
          "O SKU fornecido já pertence a outro produto desta empresa."
        );
        error.statusCode = 409;
        error.code = "PRODUCT_SKU_CONFLICT";
        throw error;
      }
    }

    try {
      const [updatedProduct] = await knex("products")
        .where({
          id: productInternalId,
          company_id: companyInternalId,
        })
        .update(
          {
            ...updateData,
            updated_at: knex.fn.now(),
          },
          "*"
        );

      log.info(`Produto #${productId} da empresa #${companyId} atualizado.`);
      return this.getProductById(fastify, companyId, updatedProduct.public_id);
    } catch (error) {
      log.error(error, `Erro ao atualizar produto #${productId}`);

      // Tratamento do erro de violação de unicidade
      if (error.code === "23505") {
        const customError = new Error(
          "O SKU fornecido já pertence a outro produto desta empresa."
        );
        customError.statusCode = 409;
        customError.code = "PRODUCT_SKU_CONFLICT";
        throw customError;
      }

      throw new Error("Não foi possível atualizar o produto.");
    }
  }

  /**
   * Exclui um produto específico
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @param {number} productId
   * @returns {Promise<object>}
   */
  async deleteProduct(fastify, companyId, productId) {
    const { knex, log } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const productInternalId = await this._resolveProductId(knex, productId);

    // Verifica se existem quote_items que referenciam este produto
    const quotesUsingProduct = await knex("quote_items")
      .where({ product_id: productInternalId })
      .first();

    if (quotesUsingProduct) {
      const error = new Error(
        "Não é possível excluir este produto pois ele está sendo usado em orçamentos existentes."
      );
      error.statusCode = 422;
      error.code = "PRODUCT_IN_USE";
      throw error;
    }

    const result = await knex("products")
      .where({
        id: productInternalId,
        company_id: companyInternalId,
      })
      .del();

    if (result === 0) {
      const error = new Error("Produto não encontrado para exclusão.");
      error.statusCode = 404;
      error.code = "PRODUCT_NOT_FOUND";
      throw error;
    }

    log.info(`Produto #${productId} da empresa #${companyId} excluído.`);
    return { message: "Produto excluído com sucesso." };
  }

  /**
   * Conta o número total de produtos de uma empresa
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @returns {Promise<number>}
   */
  async getProductCount(fastify, companyId) {
    const companyInternalId = await this._resolveCompanyId(
      fastify.knex,
      companyId
    );
    const [{ count }] = await fastify
      .knex("products")
      .where({ company_id: companyInternalId })
      .count("id as count");

    return parseInt(count);
  }

  /**
   * Busca produtos ativos para uso em orçamentos
   * @param {import('fastify').FastifyInstance} fastify
   * @param {number} companyId
   * @returns {Promise<array>}
   */
  async getActiveProducts(fastify, companyId) {
    const companyInternalId = await this._resolveCompanyId(
      fastify.knex,
      companyId
    );
    const products = await fastify
      .knex("products as p")
      .join("companies as c", "p.company_id", "c.id")
      .where({
        "p.company_id": companyInternalId,
        "p.is_active": true,
      })
      .select("p.*", "c.public_id as company_public_id")
      .orderBy("p.name", "asc");
    return products.map(mapProductPublicId);
  }
}

module.exports = new ProductService();
