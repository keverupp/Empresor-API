"use strict";

const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
} = require("../../schemas/authSchemas");

module.exports = async function (fastify, opts) {
  // Acesse o AuthService através do fastify.services,
  // que foi populado pelo seu plugin loadServices.js.
  // O nome 'auth' é derivado de 'authService.js'.
  const AuthService = fastify.services && fastify.services.auth;

  // Verificação de segurança: Garante que o AuthService foi carregado.
  if (!AuthService) {
    fastify.log.error(
      "[AuthRoutes] AuthService não foi carregado! Verifique o plugin 'loadServices.js' e se o arquivo 'services/authService.js' existe e exporta corretamente."
    );
  }

  // Helper handleServiceCall (como você definiu, adaptado para verificar AuthService)
  async function handleServiceCall(reply, serviceFnName, servicePayload) {
    // Verifica se o AuthService e a função específica existem antes de chamar
    if (!AuthService || typeof AuthService[serviceFnName] !== "function") {
      const errorMessage = `[AuthRoutes] Tentativa de chamar uma função de serviço inválida ou não existente: AuthService.${serviceFnName}`;
      fastify.log.error(errorMessage);
      reply.code(500).send({
        statusCode: 500,
        error: "InternalServerError",
        message: "Configuração interna do serviço de autenticação inválida.",
      });
      return null;
    }

    try {
      // As funções do AuthService esperam 'fastify' como primeiro argumento
      const result = await AuthService[serviceFnName](fastify, servicePayload);
      return result;
    } catch (error) {
      fastify.log.error(
        error,
        `[AuthRoutes] Erro no serviço AuthService.${serviceFnName}`
      );
      const statusCode = error.statusCode || 500;
      const message = error.message || "Ocorreu um erro inesperado.";
      const errorCode =
        error.code ||
        (statusCode === 500
          ? "INTERNAL_SERVER_ERROR"
          : "BAD_REQUEST_OR_UNAUTHORIZED"); // Pode ser ajustado conforme os códigos de erro do seu serviço
      reply.code(statusCode).send({ statusCode, error: errorCode, message });
      return null;
    }
  }

  // --- Rota de Registro ---
  fastify.post(
    "/register",
    { schema: registerSchema },
    async (request, reply) => {
      const result = await handleServiceCall(
        reply,
        "registerUser", // Nome da função no AuthService
        request.body
      );
      if (result) {
        // handleServiceCall retorna null em caso de erro já tratado
        reply.code(201).send(result);
      }
    }
  );

  // --- Rota de Login ---
  fastify.post("/login", { schema: loginSchema }, async (request, reply) => {
    const result = await handleServiceCall(reply, "loginUser", request.body);
    if (result) {
      reply.code(200).send(result);
    }
  });

  // --- Rota de "Esqueci Minha Senha" ---
  fastify.post(
    "/forgot-password",
    { schema: forgotPasswordSchema },
    async (request, reply) => {
      const result = await handleServiceCall(
        reply,
        "initiatePasswordReset",
        request.body
      );
      if (result) {
        reply.code(200).send(result);
      }
    }
  );

  // --- Rota de Redefinição de Senha ---
  fastify.post(
    "/reset-password",
    { schema: resetPasswordSchema },
    async (request, reply) => {
      const result = await handleServiceCall(
        reply,
        "completePasswordReset",
        request.body
      );
      if (result) {
        reply.code(200).send(result);
      }
    }
  );

  // --- Rota de Refresh Token ---
  fastify.post(
    "/refresh",
    { schema: refreshTokenSchema },
    async (request, reply) => {
      const { refreshToken: providedRefreshToken } = request.body;
      const result = await handleServiceCall(reply, "handleRefreshToken", {
        providedRefreshToken,
      });
      if (result) {
        reply.code(200).send(result);
      }
    }
  );

  // --- Rota de Logout ---
  const logoutOpts = {
    schema: logoutSchema,
    // ESSENCIAL: Adicione seu hook de autenticação aqui!
    // Exemplo: preHandler: [fastify.authenticate]
  };
  // Adicione um log de aviso se o hook de autenticação não estiver presente
  if (!logoutOpts.preHandler && fastify.authenticate) {
    logoutOpts.preHandler = [fastify.authenticate]; // Tenta adicionar se existir
    fastify.log.info(
      "[AuthRoutes] Hook fastify.authenticate adicionado à rota /logout."
    );
  } else if (!fastify.authenticate) {
    fastify.log.warn(
      "[AuthRoutes] Rota /logout NÃO ESTÁ PROTEGIDA. Hook fastify.authenticate não encontrado."
    );
  }

  fastify.post("/logout", logoutOpts, async (request, reply) => {
    // Se a rota estiver protegida por fastify.authenticate, request.user será populado.
    if (!request.user || !request.user.userId) {
      fastify.log.warn(
        "[AuthRoutes] Tentativa de logout sem usuário autenticado válido na rota /logout. Verifique a proteção da rota."
      );
      return reply.code(401).send({
        statusCode: 401,
        error: "UNAUTHORIZED",
        message: "Não autorizado. A autenticação é necessária para o logout.",
      });
    }

    const result = await handleServiceCall(reply, "logoutUser", {
      userId: request.user.userId,
    });
    if (result) {
      reply.code(200).send(result);
    }
  });
};
