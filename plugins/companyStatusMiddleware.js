// plugins/companyStatusMiddleware.js
"use strict";

const fp = require("fastify-plugin");

async function companyStatusMiddleware(fastify, opts) {
  // Decora o Fastify com utilitários para verificação de status da empresa
  fastify.decorate("companyStatus", {
    /**
     * Middleware para verificar se a empresa está ativa antes de permitir operações
     * Bloqueia completamente se a empresa estiver inativa
     * @returns {Function} Função middleware do Fastify
     */
    checkActiveCompany: () => {
      return async (request, reply) => {
        // Verifica se o usuário está autenticado
        if (!request.user || !request.user.userId) {
          const error = new Error("Usuário não autenticado.");
          error.statusCode = 401;
          error.code = "Unauthorized";
          throw error;
        }

        // Extrai o companyId da URL
        const companyId = request.params.companyId;
        if (!companyId) {
          const error = new Error("ID da empresa não fornecido.");
          error.statusCode = 400;
          error.code = "BadRequest";
          throw error;
        }

        try {
          // Busca os dados da empresa no banco
          const company = await fastify
            .knex("companies")
            .select("status", "owner_id", "name")
            .where("public_id", companyId)
            .first();

          if (!company) {
            const error = new Error("Empresa não encontrada.");
            error.statusCode = 404;
            error.code = "NotFound";
            throw error;
          }

          // Verifica se a empresa está inativa
          if (company.status === "inactive") {
            const error = new Error(
              `A empresa "${company.name}" está inativa. Reative sua empresa para continuar cadastrando clientes e gerando orçamentos.`
            );
            error.statusCode = 403;
            error.code = "CompanyInactive";
            error.companyId = companyId;
            error.companyStatus = company.status;
            throw error;
          }

          // Empresa ativa - adiciona informações úteis ao request
          request.company = {
            id: companyId,
            name: company.name,
            status: company.status,
            isOwner: company.owner_id === request.user.userId,
          };
        } catch (error) {
          // Se já tem statusCode, é um erro que queremos propagar
          if (error.statusCode) {
            throw error;
          }

          // Log do erro inesperado
          fastify.log.error(
            error,
            `Erro ao verificar status da empresa ${companyId} no middleware companyStatus`
          );

          // Erro genérico para problemas de banco/sistema
          const systemError = new Error(
            "Não foi possível verificar o status da empresa."
          );
          systemError.statusCode = 500;
          systemError.code = "InternalServerError";
          throw systemError;
        }
      };
    },

    /**
     * Middleware específico para operações de criação (POST, PUT, PATCH)
     * Mantido por compatibilidade; atualmente comporta-se igual a checkActiveCompany
     */
    requireActiveCompanyForWrites: () => {
      return fastify.companyStatus.checkActiveCompany();
    },

    /**
     * Middleware para operações de leitura e escrita
     * Bloqueia operações em empresas inativas
     */
    checkCompanyForReadsAndWrites: () => {
      return fastify.companyStatus.checkActiveCompany();
    },
  });

  fastify.log.info("Plugin companyStatusMiddleware carregado com sucesso");
}

module.exports = fp(companyStatusMiddleware, {
  name: "company-status-middleware",
  dependencies: ["knex-connector"], // Depende do Knex
});
