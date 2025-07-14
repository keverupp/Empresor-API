// plugins/corsConfig.js - Plugin CORS personalizado por ambiente
"use strict";

const fp = require("fastify-plugin");

async function corsConfigPlugin(fastify, opts) {
  // Configuração baseada no ambiente
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  let corsOptions;

  if (isDevelopment) {
    // DESENVOLVIMENTO: Totalmente permissivo
    corsOptions = {
      origin: true, // Permite qualquer origem
      methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS", "PATCH", "HEAD"],
      allowedHeaders: "*",
      credentials: true,
      maxAge: 86400,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };

    fastify.log.info(
      "CORS configurado para DESENVOLVIMENTO (totalmente permissivo)"
    );
  } else if (isProduction) {
    // PRODUÇÃO: Mais restritivo
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : ["https://seudominio.com", "https://app.seudominio.com"];

    corsOptions = {
      origin: allowedOrigins,
      methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
      ],
      exposedHeaders: [
        "X-Total-Count",
        "X-Company-Status-Warning",
        "Content-Range",
      ],
      credentials: true,
      maxAge: 3600, // 1 hora
      preflightContinue: false,
      optionsSuccessStatus: 204,
    };

    fastify.log.info(
      `CORS configurado para PRODUÇÃO com origens: ${allowedOrigins.join(", ")}`
    );
  } else {
    // STAGING ou outros ambientes: Moderadamente permissivo
    corsOptions = {
      origin: (origin, callback) => {
        // Lista de origens permitidas (pode vir do .env)
        const allowedOrigins = process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
          : [
              "http://localhost:3000",
              "http://localhost:3001",
              "http://localhost:8080",
              "https://staging.seudominio.com",
            ];

        // Permite se a origem estiver na lista ou se for undefined (request local)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Não permitido pelo CORS"), false);
        }
      },
      methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        "X-Custom-Header",
      ],
      credentials: true,
      maxAge: 1800, // 30 minutos
    };

    fastify.log.info("CORS configurado para STAGING/OUTROS ambientes");
  }

  // Registra o plugin @fastify/cors com as opções definidas
  await fastify.register(require("@fastify/cors"), corsOptions);

  // Adiciona um hook para log de requests CORS (opcional)
  if (isDevelopment) {
    fastify.addHook("onRequest", async (request, reply) => {
      if (request.headers.origin) {
        fastify.log.debug(
          `CORS request from origin: ${request.headers.origin}`
        );
      }
    });
  }
}

module.exports = fp(corsConfigPlugin, {
  name: "cors-config",
  // Este plugin deve ser carregado antes dos outros
});

/*
CONFIGURAÇÃO NO .env:

# Para produção
NODE_ENV=production
ALLOWED_ORIGINS=https://seuapp.com,https://www.seuapp.com,https://admin.seuapp.com

# Para desenvolvimento  
NODE_ENV=development

# Para staging
NODE_ENV=staging
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,https://staging.seuapp.com
*/
