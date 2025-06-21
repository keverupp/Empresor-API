"use strict";

// Schema para resposta de produto
const S_PRODUCT_RESPONSE = {
  $id: "ProductResponse",
  type: "object",
  properties: {
    id: { type: "integer", description: "ID do produto" },
    company_id: { type: "integer", description: "ID da empresa" },
    name: {
      type: "string",
      maxLength: 255,
      description: "Nome do produto/serviço",
    },
    description: {
      type: ["string", "null"],
      description: "Descrição detalhada do produto",
    },
    sku: {
      type: ["string", "null"],
      maxLength: 100,
      description: "Código SKU do produto",
    },
    unit_price_cents: {
      type: "integer",
      description: "Preço unitário em centavos",
    },
    unit: {
      type: ["string", "null"],
      maxLength: 50,
      description: "Unidade de medida (ex: un, kg, hr)",
    },
    is_active: {
      type: "boolean",
      description: "Se o produto está ativo",
    },
    created_at: {
      type: "string",
      format: "date-time",
      description: "Data de criação",
    },
    updated_at: {
      type: "string",
      format: "date-time",
      description: "Data da última atualização",
    },
  },
};

// Schema para criação de produto
const S_PRODUCT_CREATE_PAYLOAD = {
  $id: "ProductCreatePayload",
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 2,
      maxLength: 255,
      description: "Nome do produto/serviço",
    },
    description: {
      type: ["string", "null"],
      description: "Descrição detalhada do produto",
    },
    sku: {
      type: ["string", "null"],
      maxLength: 100,
      description: "Código SKU do produto (único por empresa)",
    },
    unit_price_cents: {
      type: "integer",
      minimum: 0,
      default: 0,
      description: "Preço unitário em centavos",
    },
    unit: {
      type: ["string", "null"],
      maxLength: 50,
      description: "Unidade de medida (ex: un, kg, hr, m²)",
    },
    is_active: {
      type: "boolean",
      default: true,
      description: "Se o produto deve estar ativo",
    },
  },
  required: ["name"],
};

// Schema para atualização de produto
const S_PRODUCT_UPDATE_PAYLOAD = {
  $id: "ProductUpdatePayload",
  type: "object",
  properties: {
    name: {
      type: "string",
      minLength: 2,
      maxLength: 255,
      description: "Nome do produto/serviço",
    },
    description: {
      type: ["string", "null"],
      description: "Descrição detalhada do produto",
    },
    sku: {
      type: ["string", "null"],
      maxLength: 100,
      description: "Código SKU do produto (único por empresa)",
    },
    unit_price_cents: {
      type: "integer",
      minimum: 0,
      description: "Preço unitário em centavos",
    },
    unit: {
      type: ["string", "null"],
      maxLength: 50,
      description: "Unidade de medida",
    },
    is_active: {
      type: "boolean",
      description: "Se o produto deve estar ativo",
    },
  },
  minProperties: 1,
};

// Schema para query parameters na listagem
const S_PRODUCT_LIST_QUERYSTRING = {
  $id: "ProductListQueryString",
  type: "object",
  properties: {
    page: {
      type: "integer",
      minimum: 1,
      default: 1,
      description: "Número da página",
    },
    pageSize: {
      type: "integer",
      minimum: 1,
      maximum: 100,
      default: 10,
      description: "Itens por página",
    },
    name: {
      type: "string",
      description: "Filtrar por nome (busca parcial)",
    },
    sku: {
      type: "string",
      description: "Filtrar por SKU",
    },
    is_active: {
      type: "boolean",
      description: "Filtrar por status ativo/inativo",
    },
    unit: {
      type: "string",
      description: "Filtrar por unidade de medida",
    },
  },
};

// Schemas das rotas completas

// POST /api/companies/:companyId/products
const createProductSchema = {
  description: "Cria um novo produto para uma empresa.",
  tags: ["Produtos"],
  summary: "Criar Produto",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "integer" } },
    required: ["companyId"],
  },
  body: { $ref: "ProductCreatePayload#" },
  response: {
    201: {
      description: "Produto criado com sucesso.",
      $ref: "ProductResponse#",
    },
    400: { $ref: "ErrorResponse#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    409: { $ref: "ErrorResponse#" }, // SKU duplicado
    422: { $ref: "ErrorResponse#" }, // Limite do plano atingido
    500: { $ref: "ErrorResponse#" },
  },
};

// GET /api/companies/:companyId/products
const listProductsSchema = {
  description: "Lista os produtos de uma empresa.",
  tags: ["Produtos"],
  summary: "Listar Produtos",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "integer" } },
    required: ["companyId"],
  },
  querystring: { $ref: "ProductListQueryString#" },
  response: {
    200: {
      description: "Lista de produtos.",
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { $ref: "ProductResponse#" },
        },
        pagination: {
          type: "object",
          properties: {
            totalItems: { type: "integer" },
            totalPages: { type: "integer" },
            currentPage: { type: "integer" },
            pageSize: { type: "integer" },
          },
        },
      },
    },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// GET /api/companies/:companyId/products/:productId
const getProductByIdSchema = {
  description: "Obtém um produto específico pelo seu ID.",
  tags: ["Produtos"],
  summary: "Obter Produto por ID",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: {
      companyId: { type: "integer" },
      productId: { type: "integer" },
    },
    required: ["companyId", "productId"],
  },
  response: {
    200: {
      description: "Detalhes do produto.",
      $ref: "ProductResponse#",
    },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// PUT /api/companies/:companyId/products/:productId
const updateProductSchema = {
  description: "Atualiza um produto específico.",
  tags: ["Produtos"],
  summary: "Atualizar Produto",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: {
      companyId: { type: "integer" },
      productId: { type: "integer" },
    },
    required: ["companyId", "productId"],
  },
  body: { $ref: "ProductUpdatePayload#" },
  response: {
    200: {
      description: "Produto atualizado com sucesso.",
      $ref: "ProductResponse#",
    },
    400: { $ref: "ErrorResponse#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    409: { $ref: "ErrorResponse#" }, // SKU duplicado
    500: { $ref: "ErrorResponse#" },
  },
};

// DELETE /api/companies/:companyId/products/:productId
const deleteProductSchema = {
  description: "Exclui um produto específico.",
  tags: ["Produtos"],
  summary: "Excluir Produto",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: {
      companyId: { type: "integer" },
      productId: { type: "integer" },
    },
    required: ["companyId", "productId"],
  },
  response: {
    200: {
      description: "Produto excluído com sucesso.",
      $ref: "SuccessMessage#",
    },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

module.exports = {
  sharedSchemas: [
    S_PRODUCT_RESPONSE,
    S_PRODUCT_CREATE_PAYLOAD,
    S_PRODUCT_UPDATE_PAYLOAD,
    S_PRODUCT_LIST_QUERYSTRING,
  ],
  createProductSchema,
  listProductsSchema,
  getProductByIdSchema,
  updateProductSchema,
  deleteProductSchema,
};
