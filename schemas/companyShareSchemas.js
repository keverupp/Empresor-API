"use strict";

const S_COMPANY_SHARE_PERMISSIONS = {
  $id: "CompanySharePermissions",
  type: "object",
  description: "Objeto com as permissões granulares do usuário.",
  properties: {
    can_view_clients: { type: "boolean", default: true },
    can_create_quotes: { type: "boolean", default: true },
    can_edit_settings: { type: "boolean", default: false },
  },
  additionalProperties: true,
};

const S_COMPANY_SHARE_PAYLOAD = {
  $id: "CompanySharePayload",
  type: "object",
  properties: {
    email: {
      type: "string",
      format: "email",
      description: "E-mail do usuário com quem compartilhar.",
    },
    permissions: { $ref: "CompanySharePermissions#" },
  },
  required: ["email", "permissions"],
};

const S_COMPANY_SHARE_RESPONSE = {
  $id: "CompanyShareResponse",
  type: "object",
  properties: {
    share_id: { type: "integer" },
    user_id: { type: "integer" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
    permissions: { $ref: "CompanySharePermissions#" },
    status: { type: "string" },
    shared_at: { type: "string", format: "date-time" },
  },
};

// Schema completo para a rota de criação
const createShareSchema = {
  description:
    "Compartilha uma empresa com outro usuário, definindo suas permissões.",
  tags: ["Empresas - Compartilhamento"],
  summary: "Compartilhar Empresa",
  security: [{ bearerAuth: [] }], // <--- ADICIONADO AQUI
  params: {
    // <--- ADICIONADO AQUI
    type: "object",
    properties: { companyId: { type: "string" } },
    required: ["companyId"],
  },
  body: { $ref: "CompanySharePayload#" },
  response: {
    201: { $ref: "CompanyShareResponse#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
  },
};

// Schema completo para a rota de listagem
const listSharesSchema = {
  description: "Lista os compartilhamentos de uma empresa.",
  tags: ["Empresas - Compartilhamento"],
  summary: "Listar Compartilhamentos",
  security: [{ bearerAuth: [] }], // <--- ADICIONADO AQUI
  params: {
    // <--- ADICIONADO AQUI
    type: "object",
    properties: { companyId: { type: "string" } },
    required: ["companyId"],
  },
  response: {
    200: { type: "array", items: { $ref: "CompanyShareResponse#" } },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
  },
};

// Schema completo para a rota de deleção
const deleteShareSchema = {
  description: "Remove o compartilhamento de uma empresa com um usuário.",
  tags: ["Empresas - Compartilhamento"],
  summary: "Remover Compartilhamento",
  security: [{ bearerAuth: [] }], // <--- ADICIONADO AQUI
  params: {
    // <--- ADICIONADO AQUI
    type: "object",
    properties: {
      companyId: { type: "string" },
      userId: { type: "integer" },
    },
    required: ["companyId", "userId"],
  },
  response: {
    200: { $ref: "SuccessMessage#" },
    401: { $ref: "ErrorResponse#" },
    403: { $ref: "ErrorResponse#" },
    404: { $ref: "ErrorResponse#" },
  },
};

module.exports = {
  sharedSchemas: [
    S_COMPANY_SHARE_PERMISSIONS,
    S_COMPANY_SHARE_PAYLOAD,
    S_COMPANY_SHARE_RESPONSE,
  ],
  createShareSchema,
  listSharesSchema,
  deleteShareSchema,
};
