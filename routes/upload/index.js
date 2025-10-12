"use strict";

const { createPresignedUrlSchema } = require("../../schemas/uploadSchemas");
const uploadService = require("../../services/uploadService");

module.exports = async function (fastify) {
  fastify.post(
    "/presigned-url",
    {
      schema: createPresignedUrlSchema,
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const { fileName, fileType } = request.body;
      const result = await uploadService.createPresignedUrl(fastify, { fileName, fileType });
      return reply.code(200).send(result);
    }
  );
};
