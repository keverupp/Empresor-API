// routes/companies/index.js
"use strict";

const {
  createCompanySchema,
  getCompaniesSchema,
  getCompanyByIdSchema,
  updateCompanySchema,
  deleteCompanySchema,
  uploadCompanyLogoSchema,
  verifyCompanySchema,
  resendValidationSchema,
} = require("../../schemas/companySchemas");

module.exports = async function (fastify, opts) {
  const CompanyService = fastify.services && fastify.services.company;
  // Hook de autenticação
  const preHandler = fastify.authenticate ? [fastify.authenticate] : [];
  if (!fastify.authenticate) {
    fastify.log.warn(
      "Hook fastify.authenticate não está definido! As rotas de /companies não serão protegidas."
    );
  }

  // Handler de erros genérico para os serviços
  async function handleServiceCall(reply, serviceFn, ...args) {
    try {
      const result = await serviceFn(fastify, ...args);
      return result;
    } catch (error) {
      const serviceName = CompanyService.constructor.name || "CompanyService";
      const methodName = serviceFn.name || "unknownMethod";
      fastify.log.error(
        error,
        `[CompanyRoutes] Erro no serviço ${serviceName}.${methodName}`
      );
      const statusCode = error.statusCode || 500;
      const errorCode =
        error.code ||
        (statusCode === 500 ? "InternalServerError" : "BadRequest");
      reply
        .code(statusCode)
        .send({ statusCode, error: errorCode, message: error.message });
      return null;
    }
  }

  // --- ROTAS EXISTENTES (sem alteração) ---

  // POST /api/companies - Criar nova empresa
  fastify.post(
    "/",
    { schema: createCompanySchema, preHandler },
    async (request, reply) => {
      const company = await handleServiceCall(
        reply,
        CompanyService.createCompany.bind(CompanyService),
        request.user.userId,
        request.body
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
      const result = await handleServiceCall(
        reply,
        CompanyService.listCompanies.bind(CompanyService),
        request.user.userId,
        request.query
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
      const company = await handleServiceCall(
        reply,
        CompanyService.getCompanyById.bind(CompanyService),
        request.user.userId,
        request.params.id
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
      const updatedCompany = await handleServiceCall(
        reply,
        CompanyService.updateCompany.bind(CompanyService),
        request.user.userId,
        request.params.id,
        request.body
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
      const result = await handleServiceCall(
        reply,
        CompanyService.deleteCompany.bind(CompanyService),
        request.user.userId,
        request.params.id
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
        return reply
          .code(400)
          .send({ message: "Nenhum arquivo de logo enviado." });
      }
      const result = await handleServiceCall(
        reply,
        CompanyService.uploadCompanyLogo.bind(CompanyService),
        request.user.userId,
        request.params.id,
        data
      );
      if (result) {
        reply.send(result);
      }
    }
  );

  // --- NOVAS ROTAS DE VALIDAÇÃO ---

  /**
   * ROTA DE VERIFICAÇÃO DE CÓDIGO
   * Ativa uma empresa que está com status 'pending_validation'.
   */
  fastify.post(
    "/:id/verify",
    { schema: verifyCompanySchema, preHandler },
    async (request, reply) => {
      const { validationCode } = request.body;
      const activatedCompany = await handleServiceCall(
        reply,
        CompanyService.verifyCompany.bind(CompanyService),
        request.user.userId,
        request.params.id,
        validationCode
      );
      if (activatedCompany) {
        reply.send(activatedCompany);
      }
    }
  );

  fastify.post(
    "/:id/resend-validation",
    { schema: resendValidationSchema, preHandler },
    async (request, reply) => {
      const result = await handleServiceCall(
        reply,
        CompanyService.resendValidationEmail.bind(CompanyService),
        request.user.userId,
        request.params.id
      );
      if (result) {
        reply.send(result);
      }
    }
  );

  fastify.register(require("./shares"));
  fastify.register(require("./clients"));
};
