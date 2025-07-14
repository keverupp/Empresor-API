// plugins/companyStatusHook.js
"use strict";

const fp = require("fastify-plugin");

async function companyStatusHook(fastify, opts) {
  // Middleware global para verificar o status da empresa em rotas específicas
  fastify.addHook("preHandler", async (request, reply) => {
    // Verifica se a rota é de orçamentos ou clientes
    const isQuoteRoute = request.url.includes("/quotes");
    const isClientRoute = request.url.includes("/clients");

    // Só aplica o middleware se for uma rota de orçamentos ou clientes
    if (!isQuoteRoute && !isClientRoute) {
      return;
    }

    // Verifica se o usuário está autenticado
    if (!request.user || !request.user.userId) {
      return;
    }

    // Extrai o companyId da URL
    const companyId = request.params.companyId;
    if (!companyId) {
      return;
    }

    try {
      // Busca os dados da empresa no banco
      const company = await fastify
        .knex("companies")
        .select("status", "owner_id")
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
        // Verifica se o usuário é o proprietário da empresa
        const isOwner = company.owner_id === request.user.userId;

        // Se for proprietário, permite visualização mas bloqueia operações de criação/edição
        if (isOwner) {
          const method = request.method.toLowerCase();
          const isReadOnlyOperation = method === "get";

          if (!isReadOnlyOperation) {
            const error = new Error(
              "Não é possível realizar esta operação. A empresa está inativa. " +
                "Reative sua empresa para continuar cadastrando clientes e gerando orçamentos."
            );
            error.statusCode = 403;
            error.code = "CompanyInactive";
            throw error;
          }
        } else {
          // Se não for proprietário, bloqueia completamente o acesso
          const error = new Error("Acesso negado. Esta empresa está inativa.");
          error.statusCode = 403;
          error.code = "CompanyInactive";
          throw error;
        }
      }
    } catch (error) {
      // Se já tem statusCode, é um erro que queremos propagar
      if (error.statusCode) {
        throw error;
      }

      // Log do erro inesperado
      fastify.log.error(
        error,
        `Erro ao verificar status da empresa ${companyId} no companyStatusHook`
      );

      // Erro genérico para problemas de banco/sistema
      const systemError = new Error(
        "Não foi possível verificar o status da empresa."
      );
      systemError.statusCode = 500;
      systemError.code = "InternalServerError";
      throw systemError;
    }
  });

  fastify.log.info("Plugin companyStatusHook carregado com sucesso");
}

module.exports = fp(companyStatusHook, {
  name: "company-status-hook",
  dependencies: ["auth-hook", "knex-connector"], // Depende da autenticação e do Knex
});
