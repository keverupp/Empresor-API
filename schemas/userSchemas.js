"use strict";

// Schema para a resposta do perfil do usuário
const S_USER_PROFILE_RESPONSE = {
  $id: "UserProfileResponse",
  type: "object",
  properties: {
    id: { type: "integer", description: "ID do usuário" },
    name: { type: "string", description: "Nome do usuário" },
    email: {
      type: "string",
      format: "email",
      description: "E-mail do usuário",
    },
    role: { type: "string", description: "Papel do usuário" },
    status: { type: "string", description: "Status da conta do usuário" },
    created_at: {
      type: "string",
      format: "date-time",
      description: "Data de criação da conta",
    },
    // Detalhes do plano ativo do usuário
    active_plan: {
      type: "object",
      nullable: true,
      properties: {
        plan_name: { type: "string", description: "Nome do plano atual" },
        status: { type: "string", description: "Status da assinatura/teste" }, // ex: active, trialing, expired
        trial_ends_at: {
          type: ["string", "null"],
          format: "date-time",
          description: "Data de término do teste (se aplicável)",
        },
        current_period_ends_at: {
          type: ["string", "null"],
          format: "date-time",
          description:
            "Data de término do período atual da assinatura paga (se aplicável)",
        },
      },
    },
  },
};

// GET /api/users/me
const getUserMeSchema = {
  description: "Retorna os detalhes do perfil do usuário autenticado.",
  tags: ["Usuário - Perfil"],
  summary: "Obter Meu Perfil",
  security: [{ bearerAuth: [] }], // Indica que requer autenticação JWT
  response: {
    200: {
      description: "Perfil do usuário retornado com sucesso.",
      $ref: "UserProfileResponse#",
    },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

// PUT /api/users/me
const updateUserMeSchema = {
  description: "Atualiza os detalhes do perfil do usuário autenticado.",
  tags: ["Usuário - Perfil"],
  summary: "Atualizar Meu Perfil",
  security: [{ bearerAuth: [] }],
  body: {
    type: "object",
    properties: {
      name: {
        type: "string",
        minLength: 2,
        description: "Novo nome do usuário",
      },
      email: {
        type: "string",
        format: "email",
        description:
          "Novo e-mail do usuário (requer atenção especial se alterado)",
      },
      currentPassword: {
        type: "string",
        description: "Senha atual (necessária se for alterar a senha)",
      },
      newPassword: {
        type: "string",
        minLength: 8,
        description: "Nova senha (mínimo 8 caracteres)",
      },
    },
    // Pelo menos um campo deve ser fornecido para atualização
    // minProperties: 1
    // (Validação mais complexa, como "newPassword requer currentPassword", é feita na lógica do handler/serviço)
  },
  response: {
    200: {
      description: "Perfil atualizado com sucesso.",
      $ref: "UserProfileResponse#",
    },
    400: {
      description: "Dados inválidos ou senha atual incorreta.",
      $ref: "ErrorResponse#",
    },
    401: { $ref: "ErrorResponse#" },
    409: {
      description: "Conflito - Novo e-mail já está em uso.",
      $ref: "ErrorResponse#",
    },
    500: { $ref: "ErrorResponse#" },
  },
};

// DELETE /api/users/me
const deleteUserMeSchema = {
  description: "Desativa (soft delete) a conta do usuário autenticado.",
  tags: ["Usuário - Perfil"],
  summary: "Desativar Minha Conta",
  security: [{ bearerAuth: [] }],
  response: {
    200: {
      // Ou 204 No Content
      description: "Conta desativada com sucesso.",
      $ref: "SuccessMessage#",
    },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

module.exports = {
  sharedSchemas: [S_USER_PROFILE_RESPONSE], // Adiciona este schema para ser carregado globalmente
  getUserMeSchema,
  updateUserMeSchema,
  deleteUserMeSchema,
};
