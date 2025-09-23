"use strict";

// Schemas reutilizáveis (building blocks)
const ClientResponse = {
  $id: "ClientResponse",
  type: "object",
  properties: {
    id: { type: "string" },
    company_id: { type: "string" },
    created_by_user_id: { type: ["string", "null"] },
    created_by_user_name: { type: ["string", "null"] },
    name: { type: "string" },
    email: { type: ["string"], format: "email" },
    phone_number: { type: ["string"] },
    document_number: { type: ["string"] },
    address_street: { type: ["string"] },
    address_city: { type: ["string"] },
    address_state: { type: ["string"] },
    address_zip_code: { type: ["string"] },
    notes: { type: ["string", "null"] },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
  },
};

const ClientCreatePayload = {
  $id: "ClientCreatePayload",
  type: "object",
  properties: {
    name: { type: "string", minLength: 2, maxLength: 255 },
    email: { type: ["string"], format: "email" },
    phone_number: { type: ["string"] },
    document_number: { type: ["string"] },
    address_street: { type: ["string"] },
    address_city: { type: ["string"] },
    address_state: { type: ["string"] },
    address_zip_code: { type: ["string"] },
    notes: { type: ["string", "null"] },
  },
  required: [
    "name",
    "email",
    "phone_number",
    "document_number",
    "address_street",
    "address_city",
    "address_state",
    "address_zip_code",
  ],
};

const ClientUpdatePayload = {
  $id: "ClientUpdatePayload",
  type: "object",
  properties: { ...ClientCreatePayload.properties },
  minProperties: 1,
};

// Schemas de rota completos
const createClientSchema = {
  description: "Cria um novo cliente para uma empresa.",
  tags: ["Clientes"],
  summary: "Criar Cliente",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "string" } },
    required: ["companyId"],
  },
  body: { $ref: "ClientCreatePayload#" },
  response: { 201: { $ref: "ClientResponse#" } },
};

const listClientsSchema = {
  description: "Lista os clientes de uma empresa.",
  tags: ["Clientes"],
  summary: "Listar Clientes",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: { companyId: { type: "string" } },
    required: ["companyId"],
  },
  response: { 200: { type: "array", items: { $ref: "ClientResponse#" } } },
};

const getClientByIdSchema = {
  description: "Obtém um cliente específico pelo seu ID.",
  tags: ["Clientes"],
  summary: "Obter Cliente por ID",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: {
      companyId: { type: "string" },
      clientId: { type: "string" },
    },
    required: ["companyId", "clientId"],
  },
  response: { 200: { $ref: "ClientResponse#" } },
};

const updateClientSchema = {
  description: "Atualiza um cliente específico.",
  tags: ["Clientes"],
  summary: "Atualizar Cliente",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: {
      companyId: { type: "string" },
      clientId: { type: "string" },
    },
    required: ["companyId", "clientId"],
  },
  body: { $ref: "ClientUpdatePayload#" },
  response: { 200: { $ref: "ClientResponse#" } },
};

const deleteClientSchema = {
  description: "Exclui um cliente específico.",
  tags: ["Clientes"],
  summary: "Excluir Cliente",
  security: [{ bearerAuth: [] }],
  params: {
    type: "object",
    properties: {
      companyId: { type: "string" },
      clientId: { type: "string" },
    },
    required: ["companyId", "clientId"],
  },
  response: { 200: { $ref: "SuccessMessage#" } },
};

// O seu plugin `loadSchemas.js` vai iterar e carregar todos estes exports
module.exports = {
  // Array para compatibilidade com a lógica de '$ref' do seu plugin
  sharedSchemas: [ClientResponse, ClientCreatePayload, ClientUpdatePayload],

  // Schemas de rota que serão acessados via `fastify.schemas.createClientSchema`
  createClientSchema,
  listClientsSchema,
  getClientByIdSchema,
  updateClientSchema,
  deleteClientSchema,
};
