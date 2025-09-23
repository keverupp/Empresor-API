"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Fastify = require("fastify");

const companiesRoutes = require("../../routes/companies");

function buildFastify({
  userId = 1,
  sharedCompanies = [],
  authenticateBehavior = "success",
} = {}) {
  const fastify = Fastify();

  fastify.decorate("companyStatus", {
    checkCompanyForReadsAndWrites() {
      return async function () {};
    },
    requireActiveCompanyForWrites() {
      return async function () {};
    },
  });

  if (authenticateBehavior === "success") {
    fastify.decorate("authenticate", async function (request, reply) {
      request.user = { userId };
    });
  } else if (authenticateBehavior === "unauthorized") {
    fastify.decorate("authenticate", async function () {
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      throw error;
    });
  } else {
    throw new Error(`Unsupported authenticate behavior: ${authenticateBehavior}`);
  }

  const getCompanyByIdCalls = [];
  const listSharedCompaniesCalls = [];

  const commonSchemas = require("../../schemas/commonSchemas");
  const companySchemasModule = require("../../schemas/companySchemas");
  const clientSchemasModule = require("../../schemas/clientSchemas");
  const productSchemasModule = require("../../schemas/productSchemas");
  const quoteSchemasModule = require("../../schemas/quoteSchemas");
  const companyShareSchemasModule = require("../../schemas/companyShareSchemas");

  const collections = [
    commonSchemas.sharedSchemas,
    companySchemasModule.sharedSchemas,
    clientSchemasModule.sharedSchemas,
    productSchemasModule.sharedSchemas,
    quoteSchemasModule.sharedSchemas,
    companyShareSchemasModule.sharedSchemas,
  ];

  const registeredSchemaIds = new Set();
  for (const group of collections) {
    if (!Array.isArray(group)) continue;
    for (const schema of group) {
      if (!schema || !schema.$id || registeredSchemaIds.has(schema.$id)) continue;
      fastify.addSchema(schema);
      registeredSchemaIds.add(schema.$id);
    }
  }

  const omitSharedSchemas = (module) => {
    const { sharedSchemas, ...rest } = module;
    return rest;
  };

  fastify.decorate("schemas", {
    ...omitSharedSchemas(clientSchemasModule),
    ...omitSharedSchemas(productSchemasModule),
    ...omitSharedSchemas(quoteSchemasModule),
    ...omitSharedSchemas(companySchemasModule),
  });

  const noopAsync = async () => ({});

  fastify.decorate("services", {
    company: {
      async getCompanyById(...args) {
        getCompanyByIdCalls.push(args);
        return {};
      },
      async _resolveCompanyId() {
        return 1;
      },
    },
    companyShare: {
      async listCompaniesSharedWithUser(instance, receivedUserId) {
        listSharedCompaniesCalls.push([instance, receivedUserId]);
        return sharedCompanies;
      },
    },
    client: {
      createClient: noopAsync,
      listClients: noopAsync,
      getClientById: noopAsync,
      updateClient: noopAsync,
      deleteClient: noopAsync,
    },
    product: {
      createProduct: noopAsync,
      listProducts: noopAsync,
      getProductById: noopAsync,
      updateProduct: noopAsync,
      deleteProduct: noopAsync,
    },
    quote: {
      createQuote: noopAsync,
      listQuotes: noopAsync,
      getQuoteById: noopAsync,
      getQuotePdfData: noopAsync,
      updateQuote: noopAsync,
      updateQuoteStatus: noopAsync,
      deleteQuote: noopAsync,
    },
    permission: {
      async getUserPlan() {
        return {};
      },
      checkPermission() {
        return true;
      },
      checkLimit() {
        return false;
      },
    },
  });

  fastify.register(companiesRoutes, { prefix: "/api/companies" });

  return { fastify, getCompanyByIdCalls, listSharedCompaniesCalls };
}

test("GET /api/companies/shared retorna as empresas compartilhadas", async (t) => {
  const sharedCompanies = [
    {
      share_id: 10,
      status: "active",
      shared_at: "2024-05-01T12:00:00.000Z",
      permissions: {
        can_view_clients: true,
        can_create_quotes: true,
        can_edit_settings: false,
      },
      company: {
        id: "company-123",
        name: "Empresa Compartilhada",
        status: "active",
        owner: {
          id: "owner-1",
          name: "Owner Name",
          email: "owner@example.com",
        },
      },
      shared_by: {
        id: "owner-1",
        name: "Owner Name",
        email: "owner@example.com",
      },
    },
  ];

  const { fastify, getCompanyByIdCalls, listSharedCompaniesCalls } = buildFastify({
    userId: 42,
    sharedCompanies,
  });

  t.after(async () => {
    await fastify.close();
  });

  await fastify.ready();

  const response = await fastify.inject({
    method: "GET",
    url: "/api/companies/shared",
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), sharedCompanies);
  assert.equal(listSharedCompaniesCalls.length, 1);
  assert.ok(listSharedCompaniesCalls[0][0]);
  assert.equal(listSharedCompaniesCalls[0][0].services, fastify.services);
  assert.equal(listSharedCompaniesCalls[0][1], 42);
  assert.equal(getCompanyByIdCalls.length, 0);
});

test(
  "GET /api/companies/shared interrompe a requisição não autenticada sem chamar serviços",
  async (t) => {
    const { fastify, getCompanyByIdCalls, listSharedCompaniesCalls } = buildFastify({
      authenticateBehavior: "unauthorized",
    });

    t.after(async () => {
      await fastify.close();
    });

    await fastify.ready();

    const response = await fastify.inject({
      method: "GET",
      url: "/api/companies/shared",
    });

    assert.equal(response.statusCode, 401);
    assert.equal(listSharedCompaniesCalls.length, 0);
    assert.equal(getCompanyByIdCalls.length, 0);
  }
);
