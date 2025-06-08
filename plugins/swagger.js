// plugins/swagger.js
"use strict";

const fp = require("fastify-plugin");

async function swaggerPlugin(fastify, options) {
  // Registrar o Swagger
  await fastify.register(require("@fastify/swagger"), {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "Empresor API",
        description: "API para gerenciamento empresarial",
        version: "1.0.0",
      },
      servers: [
        {
          // ✅ SOLUÇÃO: Usar os valores já resolvidos do config
          url: `http://${fastify.config?.HOST || "localhost"}:${
            fastify.config?.PORT || 3000
          }`,
          description: "Servidor de desenvolvimento",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    transform: ({ schema, url }) => {
      // Esta função intercepta cada rota antes de ser adicionada à documentação.
      // Usamos uma expressão regular para substituir /_parametro por /:parametro
      // Ex: /api/companies/_companyId/shares -> /api/companies/:companyId/shares
      // A regex foi ajustada para capturar tanto _param quanto [param]
      const newUrl = url.replace(/\/([\[_])(\w+)([\]_])/, "/:$2");

      return { schema, url: newUrl };
    },
  });

  // Registrar o Swagger UI
  await fastify.register(require("@fastify/swagger-ui"), {
    routePrefix: "/documentation",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });

  fastify.log.info(
    `📚 Documentação da API (Swagger UI) disponível em /documentation`
  );
}

module.exports = fp(swaggerPlugin, {
  name: "swagger-plugin",
  dependencies: ["@fastify/env"],
});
