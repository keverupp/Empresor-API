"use strict";

const fp = require("fastify-plugin");
const fs = require("fs");
const path = require("path");

async function schemasAutoload(fastify, opts) {
  // 1. Decora o objeto `fastify` para garantir que `schemas` exista.
  // Usar 'decorate' é a forma correta de adicionar novas propriedades ao Fastify.
  if (!fastify.hasDecorator("schemas")) {
    fastify.decorate("schemas", {});
  }

  const schemasPath = opts.schemasPath || path.join(__dirname, "../schemas");

  // Função interna para carregar os schemas
  function loadAndRegister(dir) {
    // Verifica se o diretório existe antes de tentar ler
    if (!fs.existsSync(dir)) {
      fastify.log.warn(`Diretório de schemas não encontrado, pulando: ${dir}`);
      return;
    }

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        loadAndRegister(fullPath); // Carrega recursivamente
      } else if (file.endsWith(".js")) {
        try {
          const schemaModule = require(fullPath);

          // Itera sobre tudo que o módulo exporta
          for (const schemaName in schemaModule) {
            const schemaObject = schemaModule[schemaName];

            // Anexa o schema ao decorator para acesso nas rotas (ex: fastify.schemas.createClientSchema)
            fastify.schemas[schemaName] = schemaObject;

            // Se for um schema compartilhável com $id, adiciona ao store global do Fastify para $ref
            if (schemaName === "sharedSchemas" && Array.isArray(schemaObject)) {
              for (const shared of schemaObject) {
                if (shared.$id && !fastify.getSchema(shared.$id)) {
                  fastify.addSchema(shared);
                }
              }
            }
          }
        } catch (err) {
          fastify.log.error(`Falha ao carregar o arquivo de schema: ${file}`);
          // Lança o erro para interromper a inicialização se um schema não puder ser carregado
          throw err;
        }
      }
    }
  }

  try {
    loadAndRegister(schemasPath);
    fastify.log.info("Plugin de schemas carregado com sucesso.");
  } catch (err) {
    fastify.log.error(
      err,
      "Ocorreu um erro crítico durante o carregamento dos schemas."
    );
    // Propaga o erro para que o Fastify pare a inicialização
    throw err;
  }
}

module.exports = fp(schemasAutoload, {
  name: "schemas-autoload",
});
