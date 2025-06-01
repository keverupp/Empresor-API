// server.js
"use strict";

const path = require("node:path");
const AutoLoad = require("@fastify/autoload");

const envSchema = {
  type: "object",
  required: [
    "PORT",
    "DATABASE_URL",
    "JWT_SECRET",
    "FRONTEND_URL",
    "EMAIL_FROM" /* ... outras obrigatórias ... */,
  ],
  properties: {
    NODE_ENV: { type: "string", default: "development" },
    PORT: { type: "integer", default: 3000 }, // Melhor usar integer para PORT
    HOST: { type: "string", default: "127.0.0.1" },
    DATABASE_URL: { type: "string" },
    JWT_SECRET: { type: "string" },

    // Constantes para Auth
    ACCESS_TOKEN_EXPIRES_IN: { type: "string", default: "1h" },
    REFRESH_TOKEN_EXPIRES_IN: { type: "string", default: "7d" },
    // Garanta que esta seja um inteiro se você for usar o valor em milissegundos diretamente do .env
    PASSWORD_RESET_TOKEN_EXPIRES_IN_MS: { type: "integer", default: 3600000 }, // 1 hora (30d seria 2592000000)

    // Configs de E-mail
    EMAIL_HOST: { type: "string" },
    EMAIL_PORT: { type: "integer" },
    EMAIL_SECURE: { type: "boolean" }, // true para SSL, false para TLS
    EMAIL_USER: { type: "string" },
    EMAIL_PASS: { type: "string" },
    EMAIL_FROM: { type: "string" }, // Ex: '"Nome App" <app@exemplo.com>'
    FRONTEND_URL: { type: "string" }, // Ex: http://localhost:8080

    // ... outras variáveis do seu .env ...
    BCRYPT_SALT_ROUNDS: { type: "integer", default: 10 }, // Se quiser controlar via .env para o plugin bcrypt
  },
};

module.exports = async function (fastify, opts) {
  // Registrar env primeiro
  await fastify.register(require("@fastify/env"), {
    confKey: "config",
    schema: envSchema,
    dotenv: true,
  });

  // Plugins básicos
  await fastify.register(require("@fastify/sensible"));
  await fastify.register(require("@fastify/cors"), { origin: "*" });

  await fastify.register(require("@fastify/jwt"), {
    secret: fastify.config.JWT_SECRET,
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
