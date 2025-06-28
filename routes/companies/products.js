"use strict";

module.exports = async function (fastify, opts) {
  const { services, schemas, knex } = fastify;

  // Hook de permissão para Produtos: Verifica se o usuário tem acesso à empresa
  // e se o plano permite uso do catálogo de produtos
  const productsPreHandler = {
    preHandler: [
      fastify.authenticate,
      async function (request, reply) {
        const { companyId } = request.params;
        const { userId } = request.user;

        try {
          // 1. Verifica se o usuário é proprietário da empresa
          let isOwner = false;
          try {
            await services.company.getCompanyById(fastify, userId, companyId);
            isOwner = true;
          } catch (ownerError) {
            // Se não for proprietário, verifica compartilhamento
            if (
              ownerError.statusCode === 403 ||
              ownerError.statusCode === 404
            ) {
              const companyInternalId = await services.company._resolveCompanyId(
                knex,
                companyId
              );
              const share = await knex("company_shares")
                .where({
                  company_id: companyInternalId,
                  shared_with_user_id: userId,
                  status: "active",
                })
                .first();

              if (!share) {
                const error = new Error(
                  "Você não tem permissão para acessar os produtos desta empresa."
                );
                error.statusCode = 403;
                throw error;
              }

              // TODO: Verificar permissões específicas do compartilhamento aqui
              // Ex: if (!share.permissions.can_manage_products) { throw error; }
            } else {
              throw ownerError;
            }
          }

          // 2. Verifica se o plano do usuário permite uso do catálogo de produtos
          if (isOwner) {
            const userPlan = await services.permission.getUserPlan(
              fastify,
              userId
            );

            if (!userPlan) {
              const error = new Error("Usuário não possui um plano ativo.");
              error.statusCode = 403;
              throw error;
            }

            // Verifica se o plano permite catálogo de produtos
            const hasProductCatalogPermission =
              services.permission.checkPermission(
                userPlan,
                "allow_product_catalog"
              );

            if (!hasProductCatalogPermission) {
              const error = new Error(
                "Seu plano atual não permite o uso do catálogo de produtos. Considere fazer upgrade para acessar esta funcionalidade."
              );
              error.statusCode = 422;
              error.code = "PLAN_FEATURE_NOT_ALLOWED";
              throw error;
            }

            // Para criação de produtos, verifica limites do plano
            if (request.method === "POST") {
              const currentProductCount =
                await services.product.getProductCount(fastify, companyId);

              // Verifica se atingiu o limite de produtos do plano
              const limitExceeded = services.permission.checkLimit(
                userPlan,
                "max_products_per_company",
                currentProductCount
              );

              if (limitExceeded) {
                const error = new Error(
                  "Limite de produtos por empresa atingido para seu plano atual. Considere fazer upgrade para adicionar mais produtos."
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
      fastify.log.error(
        error,
        "[ProductRoutes] Erro no serviço ProductService"
      );
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

  // --- DEFINIÇÃO DAS ROTAS CRUD PARA PRODUTOS ---

  // POST /api/companies/:companyId/products
  fastify.post(
    "/:companyId/products",
    { schema: schemas.createProductSchema, ...productsPreHandler },
    async (request, reply) => {
      const newProduct = await handleServiceCall(
        reply,
        services.product.createProduct.bind(services.product),
        request.params.companyId,
        request.body
      );
      if (newProduct) {
        reply.code(201).send(newProduct);
      }
    }
  );

  // GET /api/companies/:companyId/products
  fastify.get(
    "/:companyId/products",
    { schema: schemas.listProductsSchema, ...productsPreHandler },
    async (request, reply) => {
      const products = await handleServiceCall(
        reply,
        services.product.listProducts.bind(services.product),
        request.params.companyId,
        request.query
      );
      if (products) {
        reply.send(products);
      }
    }
  );

  // GET /api/companies/:companyId/products/:productId
  fastify.get(
    "/:companyId/products/:productId",
    { schema: schemas.getProductByIdSchema, ...productsPreHandler },
    async (request, reply) => {
      const product = await handleServiceCall(
        reply,
        services.product.getProductById.bind(services.product),
        request.params.companyId,
        request.params.productId
      );
      if (product) {
        reply.send(product);
      }
    }
  );

  // PUT /api/companies/:companyId/products/:productId
  fastify.put(
    "/:companyId/products/:productId",
    { schema: schemas.updateProductSchema, ...productsPreHandler },
    async (request, reply) => {
      const updatedProduct = await handleServiceCall(
        reply,
        services.product.updateProduct.bind(services.product),
        request.params.companyId,
        request.params.productId,
        request.body
      );
      if (updatedProduct) {
        reply.send(updatedProduct);
      }
    }
  );

  // DELETE /api/companies/:companyId/products/:productId
  fastify.delete(
    "/:companyId/products/:productId",
    { schema: schemas.deleteProductSchema, ...productsPreHandler },
    async (request, reply) => {
      const result = await handleServiceCall(
        reply,
        services.product.deleteProduct.bind(services.product),
        request.params.companyId,
        request.params.productId
      );
      if (result) {
        reply.send(result);
      }
    }
  );

  // ROTA ADICIONAL: GET /api/companies/:companyId/products/active
  // Para buscar apenas produtos ativos (útil para orçamentos)
  fastify.get(
    "/:companyId/products/active",
    {
      schema: {
        description: "Lista apenas os produtos ativos de uma empresa.",
        tags: ["Produtos"],
        summary: "Listar Produtos Ativos",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { companyId: { type: "string" } },
          required: ["companyId"],
        },
        response: {
          200: {
            description: "Lista de produtos ativos.",
            type: "array",
            items: { $ref: "ProductResponse#" },
          },
          401: { $ref: "ErrorResponse#" },
          403: { $ref: "ErrorResponse#" },
          500: { $ref: "ErrorResponse#" },
        },
      },
      ...productsPreHandler,
    },
    async (request, reply) => {
      const activeProducts = await handleServiceCall(
        reply,
        services.product.getActiveProducts.bind(services.product),
        request.params.companyId
      );
      if (activeProducts) {
        reply.send(activeProducts);
      }
    }
  );
};
