// companySchemas.js
"use strict";

// Common schema for params with an ID
const S_PARAMS_WITH_ID = {
  type: "object",
  properties: {
    id: { type: "integer", description: "Company ID" },
  },
  required: ["id"],
};

// Base properties for a company, reflecting the database schema
const companyProperties = {
  id: { type: "integer", description: "ID da Empresa" },
  owner_id: { type: "integer", description: "ID do Usuário Proprietário" },
  name: {
    type: "string",
    maxLength: 255,
    description: "Nome fantasia ou nome de exibição",
  },
  legal_name: {
    type: ["string", "null"],
    maxLength: 255,
    description: "Razão Social",
  },
  document_number: {
    type: ["string", "null"],
    maxLength: 50,
    description: "CNPJ, CPF (se aplicável)",
  },
  email: {
    type: ["string", "null"],
    format: "email",
    maxLength: 255,
    description: "E-mail de contato da empresa",
  },
  phone_number: {
    type: ["string", "null"],
    maxLength: 50,
    description: "Telefone de contato da empresa",
  },
  address_street: {
    type: ["string", "null"],
    maxLength: 255,
    description: "Logradouro",
  },
  address_number: {
    type: ["string", "null"],
    maxLength: 50,
    description: "Número",
  },
  address_complement: {
    type: ["string", "null"],
    maxLength: 255,
    description: "Complemento",
  },
  address_neighborhood: {
    type: ["string", "null"],
    maxLength: 100,
    description: "Bairro",
  },
  address_city: {
    type: ["string", "null"],
    maxLength: 100,
    description: "Cidade",
  },
  address_state: {
    type: ["string", "null"],
    maxLength: 50,
    description: "Estado/UF",
  },
  address_zip_code: {
    type: ["string", "null"],
    maxLength: 20,
    description: "CEP",
  },
  address_country: {
    type: ["string", "null"],
    maxLength: 50,
    description: "País (Padrão: BR)",
    default: "BR",
  },
  logo_url: {
    type: ["string", "null"],
    format: "url",
    maxLength: 512,
    description: "URL do logo",
  },
  pdf_preferences: {
    type: ["object", "null"],
    description: "Preferências para geração de PDF",
    properties: {
      template_id: { type: "string" },
      cor_primaria: { type: "string" }, // Assuming hex color
      mostrar_logo_rodape: { type: "boolean" },
    },
    additionalProperties: true, // Or false if the structure is fixed
    default: {},
  },
  status: {
    type: "string",
    maxLength: 50,
    description: "Status da empresa (ex: active, inactive)",
    default: "active",
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
};

// Schema for the full company response
const S_COMPANY_RESPONSE = {
  $id: "CompanyResponse",
  type: "object",
  properties: companyProperties,
};

// Schema for creating a company (request body)
const S_COMPANY_CREATE_PAYLOAD = {
  $id: "CompanyCreatePayload",
  type: "object",
  properties: {
    // owner_id: { type: "integer", description: "ID do Usuário Proprietário. Se não fornecido, pode ser o usuário autenticado." }, // owner_id will likely be set by the service from the authenticated user.
    name: companyProperties.name, // NotNullable
    legal_name: companyProperties.legal_name,
    document_number: companyProperties.document_number,
    email: companyProperties.email,
    phone_number: companyProperties.phone_number,
    address_street: companyProperties.address_street,
    address_number: companyProperties.address_number,
    address_complement: companyProperties.address_complement,
    address_neighborhood: companyProperties.address_neighborhood,
    address_city: companyProperties.address_city,
    address_state: companyProperties.address_state,
    address_zip_code: companyProperties.address_zip_code,
    address_country: companyProperties.address_country,
    pdf_preferences: companyProperties.pdf_preferences,
    status: companyProperties.status, // Defaulted in DB, but can be set
  },
  required: ["name"], // owner_id is also notNullable but often handled by the backend
};

// Schema for updating a company (request body)
const S_COMPANY_UPDATE_PAYLOAD = {
  $id: "CompanyUpdatePayload",
  type: "object",
  properties: {
    // All fields are optional for PUT (partial updates)
    name: { ...companyProperties.name, minLength: 1 }, // Ensure name is not set to empty if provided
    legal_name: companyProperties.legal_name,
    document_number: companyProperties.document_number,
    email: companyProperties.email,
    phone_number: companyProperties.phone_number,
    address_street: companyProperties.address_street,
    address_number: companyProperties.address_number,
    address_complement: companyProperties.address_complement,
    address_neighborhood: companyProperties.address_neighborhood,
    address_city: companyProperties.address_city,
    address_state: companyProperties.address_state,
    address_zip_code: companyProperties.address_zip_code,
    address_country: companyProperties.address_country,
    pdf_preferences: companyProperties.pdf_preferences,
    status: companyProperties.status,
  },
  minProperties: 1, // At least one field must be provided for an update
};

// Schema for query parameters when listing companies
const S_COMPANY_LIST_QUERYSTRING = {
  $id: "CompanyListQueryString",
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
    name: { type: "string", description: "Filtrar por nome (busca parcial)" },
    status: { type: "string", description: "Filtrar por status" },
    owner_id: {
      type: "integer",
      description: "Filtrar por ID do proprietário",
    },
    document_number: {
      type: "string",
      description: "Filtrar por número do documento",
    }, //
  },
};

// POST /companies
const createCompanySchema = {
  description: "Cria uma nova empresa.",
  tags: ["Empresas"],
  summary: "Criar Empresa",
  security: [{ bearerAuth: [] }],
  body: { $ref: "CompanyCreatePayload#" },
  response: {
    201: {
      description: "Empresa criada com sucesso.",
      $ref: "CompanyResponse#",
    },
    400: { $ref: "ErrorResponse#" }, // Bad Request (e.g., validation error)
    401: { $ref: "ErrorResponse#" }, // Unauthorized
    409: { $ref: "ErrorResponse#" }, // Conflict (e.g., document_number already exists)
    500: { $ref: "ErrorResponse#" },
  },
};

// GET /companies
const getCompaniesSchema = {
  description:
    "Lista todas as empresas do usuário autenticado ou todas (para admin).",
  tags: ["Empresas"],
  summary: "Listar Empresas",
  security: [{ bearerAuth: [] }],
  querystring: { $ref: "CompanyListQueryString#" },
  response: {
    200: {
      description: "Lista de empresas.",
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { $ref: "CompanyResponse#" },
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
    500: { $ref: "ErrorResponse#" },
  },
};

// GET /companies/:id
const getCompanyByIdSchema = {
  description: "Obtém os detalhes de uma empresa específica.",
  tags: ["Empresas"],
  summary: "Obter Empresa por ID",
  security: [{ bearerAuth: [] }],
  params: S_PARAMS_WITH_ID,
  response: {
    200: {
      description: "Detalhes da empresa.",
      $ref: "CompanyResponse#",
    },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" }, // Forbidden (user does not own this company)
    404: { $ref: "ErrorResponse#" }, // Not Found
    500: { $ref: "ErrorResponse#" },
  },
};

// PUT /companies/:id
const updateCompanySchema = {
  description: "Atualiza os detalhes de uma empresa específica.",
  tags: ["Empresas"],
  summary: "Atualizar Empresa",
  security: [{ bearerAuth: [] }],
  params: S_PARAMS_WITH_ID,
  body: { $ref: "CompanyUpdatePayload#" },
  response: {
    200: {
      description: "Empresa atualizada com sucesso.",
      $ref: "CompanyResponse#",
    },
    400: { $ref: "ErrorResponse#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    409: { $ref: "ErrorResponse#" }, // Conflict (e.g., document_number already exists for another company)
    500: { $ref: "ErrorResponse#" },
  },
};

// DELETE /companies/:id
const deleteCompanySchema = {
  description:
    "Remove uma empresa específica (soft delete ou hard delete dependendo da implementação).",
  tags: ["Empresas"],
  summary: "Remover Empresa",
  security: [{ bearerAuth: [] }],
  params: S_PARAMS_WITH_ID,
  response: {
    200: { $ref: "SuccessMessage#" }, // Or 204 No Content
    // 204: { description: "Empresa removida com sucesso.", type: "null" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// POST /companies/:id/logo
const uploadCompanyLogoSchema = {
  description:
    "Faz upload do logo para uma empresa específica. Requer 'Content-Type: multipart/form-data'.",
  tags: ["Empresas"],
  summary: "Upload de Logo da Empresa",
  security: [{ bearerAuth: [] }],
  params: S_PARAMS_WITH_ID, // Keep validating path parameters
  consumes: ["multipart/form-data"], // Crucial: tells Fastify to expect multipart
  // REMOVE THE 'body' SCHEMA for file upload routes using @fastify/multipart
  // The validation of the file's presence, type, etc., is done in the route handler
  // body: {
  //   type: "object",
  //   properties: {
  //     logo: { type: "string", format: "binary", description: "Arquivo do logo (ex: .png, .jpg)" },
  //   },
  //   required: ["logo"],
  // },
  response: {
    200: {
      description: "Logo atualizado com sucesso.",
      properties: {
        message: { type: "string" },
        logo_url: { type: "string", format: "url" },
        // Or company: { $ref: "CompanyResponse#" }
      },
    },
    400: { $ref: "ErrorResponse#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

module.exports = {
  sharedSchemas: [
    S_COMPANY_RESPONSE,
    S_COMPANY_CREATE_PAYLOAD,
    S_COMPANY_UPDATE_PAYLOAD,
    S_COMPANY_LIST_QUERYSTRING,
    // S_PARAMS_WITH_ID is simple enough not to need global registration unless widely reused by $ref
  ],
  createCompanySchema,
  getCompaniesSchema,
  getCompanyByIdSchema,
  updateCompanySchema,
  deleteCompanySchema,
  uploadCompanyLogoSchema,
};
