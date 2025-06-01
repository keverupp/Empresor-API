"use strict";

// --- Schemas Compartilhados ---
const S_USER_RESPONSE = {
  $id: "UserAuthResponse", // ID para referência via $ref
  type: "object",
  properties: {
    id: { type: "integer", description: "ID do usuário" },
    name: { type: "string", description: "Nome do usuário" },
    email: {
      type: "string",
      format: "email",
      description: "E-mail do usuário",
    },
    role: { type: "string", description: "Papel do usuário (ex: user, admin)" },
  },
};

const S_TOKENS = {
  $id: "AuthTokens",
  type: "object",
  properties: {
    accessToken: { type: "string", description: "Token de acesso JWT" },
    refreshToken: { type: "string", description: "Token de atualização JWT" },
  },
};

const S_ERROR_RESPONSE = {
  $id: "ErrorResponse",
  type: "object",
  properties: {
    statusCode: {
      type: "integer",
      description: "Código de status HTTP do erro",
    },
    error: {
      type: "string",
      description: "Nome do erro HTTP (ex: Bad Request)",
    },
    message: { type: "string", description: "Mensagem detalhada do erro" },
  },
};

const S_SUCCESS_MESSAGE = {
  $id: "SuccessMessage",
  type: "object",
  properties: {
    message: { type: "string" },
  },
};

// --- Schemas Específicos das Rotas ---

// REGISTRO
const registerSchema = {
  description: "Registra um novo usuário no sistema.",
  tags: ["Autenticação"], // Categoria no Swagger
  summary: "Registrar Novo Usuário",
  body: {
    type: "object",
    required: ["name", "email", "password"],
    properties: {
      name: {
        type: "string",
        minLength: 2,
        description: "Nome completo do usuário",
      },
      email: {
        type: "string",
        format: "email",
        description: "Endereço de e-mail único para login",
      },
      password: {
        type: "string",
        minLength: 8,
        description: "Senha (mínimo 8 caracteres)",
      },
    },
  },
  response: {
    201: {
      description:
        "Usuário registrado com sucesso. Retorna dados do usuário e tokens.",
      type: "object",
      properties: {
        user: { $ref: "UserAuthResponse#" },
        tokens: { $ref: "AuthTokens#" },
      },
    },
    409: {
      description: "Conflito - E-mail já cadastrado.",
      $ref: "ErrorResponse#",
    },
    500: {
      description: "Erro interno do servidor.",
      $ref: "ErrorResponse#",
    },
  },
};

// LOGIN
const loginSchema = {
  description: "Autentica um usuário existente e retorna tokens de acesso.",
  tags: ["Autenticação"],
  summary: "Login de Usuário",
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: {
        type: "string",
        format: "email",
        description: "E-mail do usuário",
      },
      password: { type: "string", description: "Senha do usuário" },
    },
  },
  response: {
    200: {
      description: "Login bem-sucedido. Retorna dados do usuário e tokens.",
      type: "object",
      properties: {
        user: { $ref: "UserAuthResponse#" },
        tokens: { $ref: "AuthTokens#" },
      },
    },
    401: {
      description: "Não autorizado - Credenciais inválidas.",
      $ref: "ErrorResponse#",
    },
    403: {
      description: "Proibido - Conta de usuário não está ativa.",
      $ref: "ErrorResponse#",
    },
    500: {
      description: "Erro interno do servidor.",
      $ref: "ErrorResponse#",
    },
  },
};

// ESQUECI MINHA SENHA
const forgotPasswordSchema = {
  description:
    "Inicia o processo de recuperação de senha para um e-mail fornecido.",
  tags: ["Autenticação"],
  summary: "Solicitar Recuperação de Senha",
  body: {
    type: "object",
    required: ["email"],
    properties: {
      email: {
        type: "string",
        format: "email",
        description: "E-mail do usuário para recuperação",
      },
    },
  },
  response: {
    200: {
      description: "Instruções de recuperação enviadas (se o e-mail existir).",
      $ref: "SuccessMessage#",
    },
    500: {
      description: "Erro interno do servidor.",
      $ref: "ErrorResponse#",
    },
  },
};

// REDEFINIR SENHA
const resetPasswordSchema = {
  description:
    "Redefine a senha do usuário usando um token de recuperação válido.",
  tags: ["Autenticação"],
  summary: "Redefinir Senha",
  body: {
    type: "object",
    required: ["token", "newPassword"],
    properties: {
      token: {
        type: "string",
        description: "Token de recuperação recebido por e-mail",
      },
      newPassword: {
        type: "string",
        minLength: 8,
        description: "Nova senha (mínimo 8 caracteres)",
      },
    },
  },
  response: {
    200: {
      description: "Senha redefinida com sucesso.",
      $ref: "SuccessMessage#",
    },
    400: {
      description:
        "Requisição inválida - Token inválido, expirado ou senha não atende aos critérios.",
      $ref: "ErrorResponse#",
    },
    500: {
      description: "Erro interno do servidor.",
      $ref: "ErrorResponse#",
    },
  },
};

// REFRESH TOKEN
const refreshTokenSchema = {
  description: "Gera um novo accessToken usando um refreshToken válido.",
  tags: ["Autenticação"],
  summary: "Atualizar Access Token",
  body: {
    type: "object",
    required: ["refreshToken"],
    properties: {
      refreshToken: {
        type: "string",
        description: "O refreshToken JWT válido.",
      },
    },
  },
  response: {
    200: {
      description:
        "Novo accessToken (e opcionalmente refreshToken) gerado com sucesso.",
      // Retorna S_TOKENS, que inclui accessToken e o refreshToken (que pode ser o mesmo ou um novo rotacionado)
      $ref: "AuthTokens#",
    },
    401: {
      description:
        "Não autorizado - Refresh token inválido, expirado ou revogado.",
      $ref: "ErrorResponse#",
    },
    500: {
      description: "Erro interno do servidor.",
      $ref: "ErrorResponse#",
    },
  },
};

// LOGOUT
const logoutSchema = {
  description:
    "Invalida o refreshToken do usuário no servidor. O cliente deve remover os tokens localmente.",
  tags: ["Autenticação"],
  summary: "Logout de Usuário",
  // O corpo da requisição é opcional. O logout será baseado no usuário autenticado pelo accessToken.
  // Se você quiser que o cliente envie o refreshToken para invalidação específica, adicione ao body:
  // body: {
  //   type: 'object',
  //   required: ['refreshToken'],
  //   properties: {
  //     refreshToken: { type: 'string' }
  //   }
  // },
  response: {
    200: {
      // Ou 204 No Content
      description: "Logout bem-sucedido.",
      $ref: "SuccessMessage#",
    },
    401: {
      // Se a rota for protegida e o accessToken for inválido
      description: "Não autorizado.",
      $ref: "ErrorResponse#",
    },
    500: {
      description: "Erro interno do servidor.",
      $ref: "ErrorResponse#",
    },
  },
  // Esta rota DEVE ser protegida por JWT (accessToken)
  security: [
    { bearerAuth: [] }, // Indica que requer autenticação JWT (definido no @fastify/swagger)
  ],
};

module.exports = {
  // Schemas compartilhados que precisam ser adicionados à instância do Fastify
  // para que $ref funcione corretamente e o Swagger os identifique.
  sharedSchemas: [
    S_USER_RESPONSE,
    S_TOKENS,
    S_ERROR_RESPONSE,
    S_SUCCESS_MESSAGE,
  ],

  // Schemas para cada rota
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  logoutSchema,
};
