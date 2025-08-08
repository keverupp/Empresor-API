// app.js
"use strict";

const Fastify = require("fastify");
const appService = require("./server"); // Importa a configuração do server.js

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    // pino-pretty é configurado no script `npm run dev`
  },
  // Aumenta o tempo limite padrão para inicialização dos plugins
  // evitando erros de "Plugin did not start in time" em ambientes lentos
  pluginTimeout: 20000,
  ajv: {
    customOptions: {
      allErrors: true,
      useDefaults: true, // aplica default: [] no items
      coerceTypes: true,
      removeAdditional: true,
      allowUnionTypes: true, // ✅ permite type: [..,..]
    },
  },
});

const start = async () => {
  try {
    // Primeiro registrar todos os plugins (incluindo @fastify/env)
    await fastify.register(appService);

    // AGORA fastify.config está disponível
    const port = fastify.config?.PORT || process.env.PORT || 3000;
    const host = fastify.config?.HOST || process.env.HOST || "0.0.0.0";

    await fastify.listen({
      port: Number(port),
      host: host,
    });

    // Log adicional de sucesso (opcional)
    fastify.log.info(`🚀 Servidor rodando em http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown (opcional mas recomendado)
process.on("SIGINT", async () => {
  fastify.log.info("🛑 Encerrando servidor...");
  await fastify.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  fastify.log.info("🛑 Encerrando servidor...");
  await fastify.close();
  process.exit(0);
});

start();
