"use strict";

// Schema para item de orçamento
const S_QUOTE_ITEM = {
  $id: "QuoteItem",
  type: "object",
  properties: {
    id: { type: "integer", description: "ID do item" },
    product_id: {
      type: ["string", "null"],
      description: "ID do produto (se vinculado ao catálogo)",
    },
    description: {
      type: "string",
      description: "Descrição do produto/serviço",
    },
    complement: {
      type: ["string", "null"],
      description: "Complemento da descrição",
    },
    images: {
      type: "array",
      items: { type: "string", format: "uri" },
      default: [],
      description: "URLs das imagens do item (recurso pago)",
    },
    quantity: {
      type: "number",
      minimum: 0.01,
      description: "Quantidade",
    },
    unit_price_cents: {
      type: "integer",
      minimum: 0,
      description: "Preço unitário em centavos",
    },
    total_price_cents: {
      type: "integer",
      description: "Preço total em centavos (quantity * unit_price)",
    },
    item_order: {
      type: ["integer", "null"],
      description: "Ordem do item no orçamento",
    },
  },
};

// Schema para orçamento completo (response)
const S_QUOTE_RESPONSE = {
  $id: "QuoteResponse",
  type: "object",
  properties: {
    id: { type: "string", description: "ID público do orçamento" },
    company_id: { type: "string", description: "ID da empresa" },
    client_id: { type: "string", description: "ID do cliente" },
    created_by_user_id: {
      type: ["string", "null"],
      description: "ID do usuário que criou",
    },
    created_by_user_name: {
      type: ["string", "null"],
      description: "Nome do usuário que criou",
    },
    quote_number: {
      type: "string",
      description: "Número do orçamento",
    },
    status: {
      type: "string",
      enum: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
        "invoiced",
      ],
      description: "Status do orçamento",
    },
    issue_date: {
      type: "string",
      format: "date",
      description: "Data de emissão",
    },
    expiry_date: {
      type: ["string", "null"],
      format: "date",
      description: "Data de validade",
    },
    notes: {
      type: ["string", "null"],
      description: "Observações para o cliente",
    },
    internal_notes: {
      type: ["string", "null"],
      description: "Observações internas",
    },
    terms_and_conditions_content: {
      type: ["string", "null"],
      description: "Termos e condições específicos do orçamento",
    },
    subtotal_cents: { type: "integer", description: "Subtotal em centavos" },
    discount_type: {
      type: ["string", "null"],
      enum: ["percentage", "fixed_amount", null],
      description: "Tipo de desconto",
    },
    discount_value_cents: {
      type: ["integer", "null"],
      description: "Valor do desconto aplicado em centavos",
    },
    tax_amount_cents: {
      type: ["integer", "null"],
      description: "Valor do imposto em centavos",
    },
    total_amount_cents: {
      type: "integer",
      description: "Valor total em centavos",
    },
    currency: { type: "string", default: "BRL", description: "Moeda" },
    pdf_url: { type: ["string", "null"], description: "URL do PDF gerado" },
    accepted_at: {
      type: ["string", "null"],
      format: "date-time",
      description: "Data de aceite",
    },
    rejected_at: {
      type: ["string", "null"],
      format: "date-time",
      description: "Data de rejeição",
    },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    client: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        email: { type: ["string", "null"] },
        phone_number: { type: ["string", "null"] },
        document_number: { type: ["string", "null"] },
      },
    },
    items: {
      type: "array",
      items: { $ref: "QuoteItem#" },
    },
  },
};

// Schema para criação de orçamento (payload)
const S_QUOTE_CREATE_PAYLOAD = {
  $id: "QuoteCreatePayload",
  type: "object",
  additionalProperties: false,
  properties: {
    client_id: {
      type: "string",
      description: "ID do cliente",
    },
    quote_number: {
      type: "string",
      minLength: 1,
      maxLength: 50,
      description: "Número do orçamento (único por empresa)",
    },
    issue_date: {
      type: "string",
      format: "date",
      description: "Data de emissão (padrão: hoje)",
    },
    expiry_date: {
      type: ["string", "null"],
      format: "date",
      description: "Data de validade",
    },
    notes: {
      type: ["string", "null"],
      description: "Observações para o cliente",
    },
    internal_notes: {
      type: ["string", "null"],
      description: "Observações internas",
    },
    terms_and_conditions_content: {
      type: ["string", "null"],
      description: "Termos e condições específicos",
    },
    discount_type: {
      type: ["string", "null"],
      enum: ["percentage", "fixed_amount", null],
      description: "Tipo de desconto",
    },
    // quando percentage: taxa (%). quando fixed_amount: valor em centavos.
    discount_value_cents: {
      type: ["number", "integer", "null"],
      minimum: 0,
      description: "Taxa (%) se percentage; valor em centavos se fixed_amount",
    },
    tax_amount_cents: {
      type: ["integer", "null"],
      minimum: 0,
      description: "Valor do imposto em centavos",
    },
    currency: { type: "string", default: "BRL", description: "Moeda" },
    items: {
      type: "array",
      minItems: 0, // ✅ permite vazio
      default: [], // ✅ preenche [] se ausente (com useDefaults)
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          product_id: {
            type: ["string", "null"],
            description: "ID do produto (opcional)",
          },
          description: {
            type: "string",
            minLength: 1,
            description: "Descrição do item",
          },
          quantity: {
            type: "number",
            minimum: 0.01,
            description: "Quantidade",
          },
          unit_price_cents: {
            type: "integer",
            minimum: 0,
            description: "Preço unitário em centavos",
          },
        },
        required: ["description", "quantity", "unit_price_cents"],
      },
    },
  },
  required: ["client_id", "quote_number"], // ✅ NÃO exige items
};

// Schema para atualização de orçamento (payload)
const S_QUOTE_UPDATE_PAYLOAD = {
  $id: "QuoteUpdatePayload",
  type: "object",
  additionalProperties: false,
  properties: {
    client_id: { type: "string" },
    quote_number: { type: "string", minLength: 1, maxLength: 50 },
    status: {
      type: "string",
      enum: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
        "invoiced",
      ],
    },
    issue_date: { type: "string", format: "date" },
    expiry_date: { type: ["string", "null"], format: "date" },
    notes: { type: ["string", "null"] },
    internal_notes: { type: ["string", "null"] },
    terms_and_conditions_content: { type: ["string", "null"] },
    discount_type: {
      type: ["string", "null"],
      enum: ["percentage", "fixed_amount", null],
    },
    // idem create: aceita número para percentual
    discount_value_cents: { type: ["number", "integer", "null"], minimum: 0 },
    tax_amount_cents: { type: ["integer", "null"], minimum: 0 },
    items: {
      type: "array",
      minItems: 0, // ✅ aceita [] para limpar itens
      default: [], // se vier explicitamente null, trate no handler
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: {
            type: ["integer", "null"],
            description: "ID do item (para atualização)",
          },
          product_id: { type: ["string", "null"] },
          description: { type: "string", minLength: 1 },
          quantity: { type: "number", minimum: 0.01 },
          unit_price_cents: { type: "integer", minimum: 0 },
        },
        required: ["description", "quantity", "unit_price_cents"],
      },
    },
  },
  minProperties: 1,
};

// Schema para query parameters
const S_QUOTE_LIST_QUERYSTRING = {
  $id: "QuoteListQueryString",
  type: "object",
  properties: {
    page: { type: "integer", minimum: 1, default: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 100, default: 10 },
    status: {
      type: "string",
      enum: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "rejected",
        "expired",
        "invoiced",
      ],
    },
    client_id: { type: "string" },
    quote_number: { type: "string" },
    issue_date_from: { type: "string", format: "date" },
    issue_date_to: { type: "string", format: "date" },
    expiry_date_from: { type: "string", format: "date" },
    expiry_date_to: { type: "string", format: "date" },
  },
};

// Schemas de rotas completas

// POST /api/companies/:companyId/quotes
const createQuoteSchema = {
  description: "Cria um novo orçamento para uma empresa.",
  tags: ["Orçamentos"],
  summary: "Criar Orçamento",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "string" } },
    required: ["companyId"],
  },
  body: { $ref: "QuoteCreatePayload#" },
  response: {
    201: { $ref: "QuoteResponse#" },
    400: { $ref: "ErrorResponse#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" }, // Cliente não encontrado
    409: { $ref: "ErrorResponse#" }, // Quote number duplicado
    422: { $ref: "ErrorResponse#" }, // Limite do plano atingido
    500: { $ref: "ErrorResponse#" },
  },
};

// GET /api/companies/:companyId/quotes
const listQuotesSchema = {
  description: "Lista os orçamentos de uma empresa.",
  tags: ["Orçamentos"],
  summary: "Listar Orçamentos",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "string" } },
    required: ["companyId"],
  },
  querystring: { $ref: "QuoteListQueryString#" },
  response: {
    200: {
      type: "object",
      properties: {
        data: { type: "array", items: { $ref: "QuoteResponse#" } },
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

// GET /api/companies/:companyId/quotes/:quoteId
const getQuoteByIdSchema = {
  description: "Obtém um orçamento específico com todos os detalhes.",
  tags: ["Orçamentos"],
  summary: "Obter Orçamento por ID",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "string" }, quoteId: { type: "string" } },
    required: ["companyId", "quoteId"],
  },
  response: {
    200: { $ref: "QuoteResponse#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// GET /api/companies/:companyId/quotes/:quoteId/pdf-data
const getQuotePdfDataSchema = {
  description: "Retorna dados do orçamento formatados para geração de PDF.",
  tags: ["Orçamentos"],
  summary: "Dados para PDF do Orçamento",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "string" }, quoteId: { type: "string" } },
    required: ["companyId", "quoteId"],
  },
  response: {
    200: {
      type: "object",
      required: ["title", "data"],
      properties: {
        title: { type: "string" },
        data: {
          type: "object",
          required: ["logo", "watermark", "budget"],
          properties: {
            logo: {
              type: "object",
              required: ["url"],
              properties: {
                url: { type: "string", format: "uri" },
              },
            },
            watermark: {
              type: "object",
              required: ["type"],
              properties: {
                type: { type: "string" },
                logo: {
                  type: "object",
                  required: ["url"],
                  properties: {
                    url: { type: "string", format: "uri" },
                  },
                },
              },
            },
            budget: {
              type: "object",
              required: ["number", "validUntil", "status", "company", "client", "items"],
              properties: {
                number: { type: "string" },
                validUntil: { type: "string" },
                status: { type: "string" },
                company: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    cnpj: { type: ["string", "null"] },
                    address: { type: ["string", "null"] },
                    phone: { type: ["string", "null"] },
                    email: { type: ["string", "null"] },
                  },
                },
                client: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    phone: { type: ["string", "null"] },
                  },
                },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["description", "quantity", "unitPrice"],
                    properties: {
                      description: { type: "string" },
                      quantity: { type: "number" },
                      unitPrice: { type: "number" },
                      complement: { type: ["string", "null"] },
                      images: {
                        type: "array",
                        items: { type: "string", format: "uri" },
                        default: [],
                      },
                    },
                  },
                },
                discount: { type: "number" },
                notes: { type: ["string", "null"] },
                terms: { type: ["string", "null"] },
              },
            },
          },
        },
      },
    },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// PUT /api/companies/:companyId/quotes/:quoteId
const updateQuoteSchema = {
  description: "Atualiza um orçamento específico.",
  tags: ["Orçamentos"],
  summary: "Atualizar Orçamento",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "string" }, quoteId: { type: "string" } },
    required: ["companyId", "quoteId"],
  },
  body: { $ref: "QuoteUpdatePayload#" },
  response: {
    200: { $ref: "QuoteResponse#" },
    400: { $ref: "ErrorResponse#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    409: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// DELETE /api/companies/:companyId/quotes/:quoteId
const deleteQuoteSchema = {
  description: "Exclui um orçamento específico.",
  tags: ["Orçamentos"],
  summary: "Excluir Orçamento",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "string" }, quoteId: { type: "string" } },
    required: ["companyId", "quoteId"],
  },
  response: {
    200: { $ref: "SuccessMessage#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    422: { $ref: "ErrorResponse#" }, // Não pode excluir se aceito
    500: { $ref: "ErrorResponse#" },
  },
};

// PUT /api/companies/:companyId/quotes/:quoteId/status
const updateQuoteStatusSchema = {
  description: "Atualiza apenas o status de um orçamento.",
  tags: ["Orçamentos"],
  summary: "Atualizar Status do Orçamento",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "string" }, quoteId: { type: "string" } },
    required: ["companyId", "quoteId"],
  },
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: [
          "draft",
          "sent",
          "viewed",
          "accepted",
          "rejected",
          "expired",
          "invoiced",
        ],
      },
    },
    required: ["status"],
  },
  response: {
    200: { $ref: "QuoteResponse#" },
    400: { $ref: "ErrorResponse#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// ── Schemas para itens (payloads) ─────────────────────────────────────────────
const QuoteItemAddPayload = {
  $id: "QuoteItemAddPayload",
  type: "object",
  additionalProperties: false,
  required: ["description", "quantity", "unit_price_cents"],
  description: "Payload para adicionar item ao orçamento",
  properties: {
    product_id: {
      type: ["string", "null"],
      description: "ID público do produto (opcional)",
    },
    description: {
      type: "string",
      minLength: 1,
      description: "Descrição do item",
    },
    complement: {
      type: ["string", "null"],
      description: "Complemento da descrição",
    },
    images: {
      type: "array",
      items: { type: "string", format: "uri" },
      description: "URLs das imagens do item (recurso pago)",
    },
    quantity: {
      type: "number",
      minimum: 0.01,
      description: "Quantidade (aceita fracionado)",
    },
    unit_price_cents: {
      type: "integer",
      minimum: 0,
      description: "Preço unitário em centavos",
    },
  },
};

const QuoteItemUpdatePayload = {
  $id: "QuoteItemUpdatePayload",
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  description:
    "Payload para atualizar item do orçamento (envie apenas campos que quer alterar)",
  properties: {
    product_id: {
      type: ["string", "null"],
      description: "ID público do produto (ou null para desvincular)",
    },
    description: {
      type: "string",
      minLength: 1,
      description: "Descrição do item",
    },
    quantity: { type: "number", minimum: 0.01, description: "Quantidade" },
    unit_price_cents: {
      type: "integer",
      minimum: 0,
      description: "Preço unitário em centavos",
    },
  },
};

module.exports = {
  sharedSchemas: [
    S_QUOTE_ITEM,
    S_QUOTE_RESPONSE,
    S_QUOTE_CREATE_PAYLOAD,
    S_QUOTE_UPDATE_PAYLOAD,
    S_QUOTE_LIST_QUERYSTRING,
    QuoteItemAddPayload,
    QuoteItemUpdatePayload,
  ],
  createQuoteSchema,
  listQuotesSchema,
  getQuoteByIdSchema,
  getQuotePdfDataSchema,
  updateQuoteSchema,
  deleteQuoteSchema,
  updateQuoteStatusSchema,
};
