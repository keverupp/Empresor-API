"use strict";

const S_ERROR_RESPONSE = {
  $id: "ErrorResponse", // Usado em $ref
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
  $id: "SuccessMessage", // Usado em $ref
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Mensagem de sucesso da operação.",
    },
  },
};

module.exports = {
  sharedSchemas: [S_ERROR_RESPONSE, S_SUCCESS_MESSAGE],
};
