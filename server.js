// server.js
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
  await fastify.register(require("@fastify/cors"), { origin: "*" });

  await fastify.register(require("@fastify/jwt"), {
    secret: fastify.config.JWT_SECRET,
  });

  await fastify.register(require("@fastify/multipart"), {
    limits: {
      fieldNameSize: 100, // Max field name size in bytes
      fieldSize: 1000000, // Max field value size in bytes
      fields: 10, // Max number of non-file fields
      fileSize: 5 * 1024 * 1024, // Max file size in bytes (ex: 5MB)
      files: 1, // Max number of file fields
      headerPairs: 2000, // Max number of header key=>value pairs
    },
  });

  // AutoLoad de plugins e rotas
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
