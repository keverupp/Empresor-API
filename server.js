// server.js - CORRIGIDO: Remove registro manual do CORS
"use strict";

const path = require("node:path");
const AutoLoad = require("@fastify/autoload");
const envSchema = require("./schemas/envSchema");

module.exports = async function (fastify, opts) {
  await fastify.register(require("@fastify/env"), {
    confKey: "config",
    schema: envSchema,
    dotenv: true,
  });

  await fastify.register(require("@fastify/sensible"));

  // REMOVIDO: await fastify.register(require("./plugins/corsConfig"));
  // O plugin corsConfig.js será carregado automaticamente pelo AutoLoad abaixo

  await fastify.register(require("@fastify/jwt"), {
    secret: fastify.config.JWT_SECRET,
  });

  await fastify.register(require("@fastify/multipart"), {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1000000,
      fields: 10,
      fileSize: 5 * 1024 * 1024,
      files: 1,
      headerPairs: 2000,
    },
  });

  // AutoLoad de plugins e rotas
  // O plugin corsConfig.js será carregado automaticamente aqui
  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, "plugins"),
    options: Object.assign({}, opts),
  });

  await fastify.register(AutoLoad, {
    dir: path.join(__dirname, "routes"),
    options: Object.assign({ prefix: "/api" }, opts),
  });

  fastify.get("/", async (request, reply) => {
    return { uptime: process.uptime() };
  });
};
