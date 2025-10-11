"use strict";

const S_PRESIGNED_URL_PAYLOAD = {
  $id: "PresignedUrlPayload",
  type: "object",
  properties: {
    fileName: { type: "string", description: "Nome do arquivo original" },
    fileType: { type: "string", description: "MIME type do arquivo" },
  },
  required: ["fileName", "fileType"],
};

const S_PRESIGNED_URL_RESPONSE = {
  $id: "PresignedUrlResponse",
  type: "object",
  properties: {
    uploadUrl: { type: "string", format: "uri", description: "URL para fazer o upload (PUT)" },
    fileUrl: { type: "string", format: "uri", description: "URL final do arquivo" },
  },
  required: ["uploadUrl", "fileUrl"],
};

const createPresignedUrlSchema = {
  description: "Gera uma URL pré-assinada para upload de arquivo no MinIO.",
  tags: ["Upload"],
  summary: "Gerar URL de Upload",
  security: [{ bearerAuth: [] }],
  body: { $ref: "PresignedUrlPayload#" },
  response: {
    200: { $ref: "PresignedUrlResponse#" },
    400: { $ref: "ErrorResponse#" },
    401: { $ref: "ErrorResponse#" },
    500: { $ref: "ErrorResponse#" },
  },
};

module.exports = {
  sharedSchemas: [
    S_PRESIGNED_URL_PAYLOAD,
    S_PRESIGNED_URL_RESPONSE,
  ],
  createPresignedUrlSchema,
};
