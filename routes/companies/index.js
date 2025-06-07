// routes/companies/index.js
"use strict";

const {
  createCompanySchema,
  getCompaniesSchema,
  getCompanyByIdSchema,
  updateCompanySchema,
  deleteCompanySchema,
  uploadCompanyLogoSchema,
} = require("../../schemas/companySchemas");

module.exports = async function (fastify, opts) {
  const preHandler = fastify.authenticate ? [fastify.authenticate] : [];
  if (!fastify.authenticate) {
    fastify.log.warn(
      "Hook fastify.authenticate não está definido! As rotas de /companies não serão protegidas por JWT por padrão."
    );
  }

  async function handleServiceCall(reply, serviceFn, ...args) {
    try {
      const result = await serviceFn(fastify, ...args);
      return result;
    } catch (error) {
      // Corrected logging for class instance name
      const serviceName = CompanyService.constructor.name || "UnknownService";
      const methodName = serviceFn.name || "unknownMethod"; // .name on a bound function might give "bound methodName"
      fastify.log.error(
        error,
        `[CompanyRoutes] Erro no serviço ${serviceName}.${methodName.replace(
          /^bound\s*/,
          ""
        )}`
      );

      const statusCode = error.statusCode || 500;
      let message = error.message || "Ocorreu um erro inesperado.";
      let errorCode =
        error.code ||
        (statusCode === 500 ? "InternalServerError" : "BadRequest");

      if (
        error.name === "SequelizeUniqueConstraintError" ||
        (error.message && error.message.includes("UNIQUE constraint failed"))
      ) {
        message = `Conflito: ${
          error.errors
            ? error.errors[0].message
            : "Já existe um registro com os dados fornecidos."
        }`;
      }

      reply.code(statusCode).send({ statusCode, error: errorCode, message });
      return null;
    }
  }

  // POST /api/companies - Criar nova empresa
  fastify.post(
    "/",
    { schema: createCompanySchema, preHandler },
    async (request, reply) => {
      const companyData = request.body;
      const userId = request.user.userId;

      // createCompany does not use 'this.method' internally in the provided service, but binding is a good practice if it might in the future.
      const company = await handleServiceCall(
        reply,
        CompanyService.createCompany.bind(CompanyService), // Bind context
        userId,
        companyData
      );
      if (company) {
        reply.code(201).send(company);
      }
    }
  );

  // GET /api/companies - Listar empresas
  fastify.get(
    "/",
    { schema: getCompaniesSchema, preHandler },
    async (request, reply) => {
      const userId = request.user.userId;
      const queryParams = request.query;

      // listCompanies does not use 'this.method' internally.
      const result = await handleServiceCall(
        reply,
        CompanyService.listCompanies.bind(CompanyService), // Bind context
        userId,
        queryParams
      );
      if (result) {
        reply.send(result);
      }
    }
  );

  // GET /api/companies/:id - Obter empresa por ID
  fastify.get(
    "/:id",
    { schema: getCompanyByIdSchema, preHandler },
    async (request, reply) => {
      const userId = request.user.userId;
      const companyId = request.params.id;

      // getCompanyById does not use 'this.method' internally.
      const company = await handleServiceCall(
        reply,
        CompanyService.getCompanyById.bind(CompanyService), // Bind context
        userId,
        companyId
      );
      if (company) {
        reply.send(company);
      }
    }
  );

  // PUT /api/companies/:id - Atualizar empresa
  fastify.put(
    "/:id",
    { schema: updateCompanySchema, preHandler },
    async (request, reply) => {
      const userId = request.user.userId;
      const companyId = request.params.id;
      const updateData = request.body;

      // updateCompany *uses* this.getCompanyById
      const updatedCompany = await handleServiceCall(
        reply,
        CompanyService.updateCompany.bind(CompanyService), // Bind context
        userId,
        companyId,
        updateData
      );
      if (updatedCompany) {
        reply.send(updatedCompany);
      }
    }
  );

  // DELETE /api/companies/:id - Remover empresa
  fastify.delete(
    "/:id",
    { schema: deleteCompanySchema, preHandler },
    async (request, reply) => {
      const userId = request.user.userId;
      const companyId = request.params.id;

      // deleteCompany *uses* this.getCompanyById
      const result = await handleServiceCall(
        reply,
        CompanyService.deleteCompany.bind(CompanyService), // Bind context
        userId,
        companyId
      );
      if (result) {
        reply.send(result);
      }
    }
  );

  // POST /api/companies/:id/logo - Upload de logo
  fastify.post(
    "/:id/logo",
    { schema: uploadCompanyLogoSchema, preHandler },
    async (request, reply) => {
      const data = await request.file();
      if (!data || !data.file) {
        reply.code(400).send({
          statusCode: 400,
          error: "BadRequest",
          message: "Nenhum arquivo de logo enviado ou formato inválido.",
        });
        return;
      }

      const userId = request.user.userId;
      const companyId = request.params.id;

      // uploadCompanyLogo *uses* this.getCompanyById
      const result = await handleServiceCall(
        reply,
        CompanyService.uploadCompanyLogo.bind(CompanyService), // Bind context
        userId,
        companyId,
        data
      );

      if (result) {
        reply.send(result);
      }
    }
  );
};
