// schemas/dashboardSchemas.js
"use strict";

// Schemas reutilizáveis (building blocks)
const DashboardFilters = {
  $id: "DashboardFilters",
  type: "object",
  properties: {
    company_id: { type: "string" },
    client_id: { type: "string" },
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
    date_from: { type: "string", format: "date" },
    date_to: { type: "string", format: "date" },
    value_min: { type: "number" },
    value_max: { type: "number" },
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};

const PaginationResponse = {
  $id: "PaginationResponse",
  type: "object",
  properties: {
    page: { type: "integer" },
    limit: { type: "integer" },
    total: { type: "integer" },
    total_pages: { type: "integer" },
  },
};

const DashboardSummaryResponse = {
  $id: "DashboardSummaryResponse",
  type: "object",
  properties: {
    total_quotations: { type: "integer" },
    draft_quotations: { type: "integer" },
    sent_quotations: { type: "integer" },
    viewed_quotations: { type: "integer" },
    accepted_quotations: { type: "integer" },
    rejected_quotations: { type: "integer" },
    expired_quotations: { type: "integer" },
    invoiced_quotations: { type: "integer" },
    total_value: { type: "number" },
    accepted_value: { type: "number" },
    monthly_stats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          month: { type: "string" },
          year: { type: "integer" },
          count: { type: "integer" },
          value: { type: "number" },
        },
      },
    },
  },
};

const DashboardQuotationItem = {
  $id: "DashboardQuotationItem",
  type: "object",
  properties: {
    id: { type: "string" },
    quote_number: { type: "string" },
    status: { type: "string" },
    notes: { type: ["string", "null"] },
    total_amount_cents: { type: "integer" },
    issue_date: { type: "string", format: "date" },
    expiry_date: { type: ["string", "null"], format: "date" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
    company: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
    },
    client: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        email: { type: ["string", "null"] },
      },
    },
  },
};

const DashboardQuotationsResponse = {
  $id: "DashboardQuotationsResponse",
  type: "object",
  properties: {
    data: {
      type: "array",
      items: { $ref: "DashboardQuotationItem#" },
    },
    pagination: { $ref: "PaginationResponse#" },
  },
};

const CompanyStatsItem = {
  $id: "CompanyStatsItem",
  type: "object",
  properties: {
    company_id: { type: "string" },
    company_name: { type: "string" },
    total_quotations: { type: "integer" },
    draft_quotations: { type: "integer" },
    sent_quotations: { type: "integer" },
    viewed_quotations: { type: "integer" },
    accepted_quotations: { type: "integer" },
    rejected_quotations: { type: "integer" },
    expired_quotations: { type: "integer" },
    invoiced_quotations: { type: "integer" },
    total_value: { type: "number" },
    accepted_value: { type: "number" },
  },
};

const TimelineItem = {
  $id: "TimelineItem",
  type: "object",
  properties: {
    period: { type: "string" },
    draft: { type: "integer" },
    sent: { type: "integer" },
    viewed: { type: "integer" },
    accepted: { type: "integer" },
    rejected: { type: "integer" },
    expired: { type: "integer" },
    invoiced: { type: "integer" },
    total_value: { type: "number" },
  },
};

const TopClientItem = {
  $id: "TopClientItem",
  type: "object",
  properties: {
    client_id: { type: "string" },
    client_name: { type: "string" },
    client_email: { type: ["string", "null"] },
    total_quotations: { type: "integer" },
    accepted_quotations: { type: "integer" },
    total_value: { type: "number" },
    accepted_value: { type: "number" },
    acceptance_rate: { type: "number" },
  },
};

// Schemas de rota completos
const dashboardSummarySchema = {
  description: "Resumo geral dos orçamentos para o dashboard",
  tags: ["Dashboard"],
  summary: "Resumo Dashboard",
  security: [{ bearerAuth: [] }],
  response: {
    200: { $ref: "DashboardSummaryResponse#" },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

const dashboardQuotationsSchema = {
  description: "Lista orçamentos com filtros para o dashboard",
  tags: ["Dashboard"],
  summary: "Lista Orçamentos Dashboard",
  security: [{ bearerAuth: [] }],
  querystring: { $ref: "DashboardFilters#" },
  response: {
    200: { $ref: "DashboardQuotationsResponse#" },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

const dashboardCompanyStatsSchema = {
  description: "Estatísticas de orçamentos por empresa",
  tags: ["Dashboard"],
  summary: "Estatísticas por Empresa",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    properties: {
      date_from: { type: "string", format: "date" },
      date_to: { type: "string", format: "date" },
    },
  },
  response: {
    200: {
      type: "array",
      items: { $ref: "CompanyStatsItem#" },
    },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

const dashboardTimelineSchema = {
  description: "Evolução dos orçamentos por status ao longo do tempo",
  tags: ["Dashboard"],
  summary: "Timeline Dashboard",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    properties: {
      period: {
        type: "string",
        enum: ["week", "month", "quarter"],
        default: "month",
      },
      months: { type: "integer", minimum: 1, maximum: 24, default: 12 },
    },
  },
  response: {
    200: {
      type: "array",
      items: { $ref: "TimelineItem#" },
    },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

const dashboardTopClientsSchema = {
  description: "Top clientes por valor de orçamentos",
  tags: ["Dashboard"],
  summary: "Top Clientes",
  security: [{ bearerAuth: [] }],
  querystring: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
      date_from: { type: "string", format: "date" },
      date_to: { type: "string", format: "date" },
    },
  },
  response: {
    200: {
      type: "array",
      items: { $ref: "TopClientItem#" },
    },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// Export dos schemas para o plugin loadSchemas.js
module.exports = {
  // Array para compatibilidade com a lógica de '$ref' do plugin
  sharedSchemas: [
    DashboardFilters,
    PaginationResponse,
    DashboardSummaryResponse,
    DashboardQuotationItem,
    DashboardQuotationsResponse,
    CompanyStatsItem,
    TimelineItem,
    TopClientItem,
  ],

  // Schemas de rota que serão acessados via `fastify.schemas.dashboardSummarySchema`
  dashboardSummarySchema,
  dashboardQuotationsSchema,
  dashboardCompanyStatsSchema,
  dashboardTimelineSchema,
  dashboardTopClientsSchema,
};
