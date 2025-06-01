// plugins/knex.js
"use strict";

const fp = require("fastify-plugin");
const Knex = require("knex");

// Configuração do Knex baseada no ambiente
function getKnexConfig(env, databaseUrl) {
  const baseConfig = {
    client: "pg",
    connection: databaseUrl,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      directory: "./migrations",
      tableName: "knex_migrations",
    },
    seeds: {
      directory: "./seeds",
    },
  };

  // Configurações específicas por ambiente
  const envConfigs = {
    development: {
      ...baseConfig,
      debug: false, // Mude para true se quiser ver queries no console
    },
    test: {
      ...baseConfig,
      pool: { min: 1, max: 1 }, // Pool menor para testes
    },
    production: {
      ...baseConfig,
      pool: {
        min: 2,
        max: 20,
      },
      acquireConnectionTimeout: 10000,
    },
  };

  return envConfigs[env] || envConfigs.development;
}

async function knexConnector(fastify, options) {
  try {
    // Verificar se as dependências estão disponíveis
    if (!fastify.config) {
      throw new Error(
        "Plugin @fastify/env deve ser registrado antes do plugin knex"
      );
    }

    if (!fastify.config.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL não está definida nas variáveis de ambiente"
      );
    }

    // Obter configuração do Knex
    const environment = fastify.config.NODE_ENV || "development";
    const knexConfig = getKnexConfig(environment, fastify.config.DATABASE_URL);

    fastify.log.info(`Inicializando Knex para ambiente: ${environment}`);

    // Criar instância do Knex
    const knexInstance = Knex(knexConfig);

    // Testar conexão
    await knexInstance.raw("SELECT 1 as test");
    fastify.log.info("✅ Conexão com banco de dados estabelecida com sucesso");

    // Decorar o Fastify com a instância do Knex
    fastify.decorate("knex", knexInstance);

    // Adicionar hook para fechar conexão quando o servidor for encerrado
    fastify.addHook("onClose", async (instance) => {
      if (instance.knex) {
        await instance.knex.destroy();
        instance.log.info("🔌 Conexões do Knex encerradas");
      }
    });

    // Registrar comandos úteis no log
    fastify.log.info("📊 Comandos Knex disponíveis:");
    fastify.log.info("  - Migrations: npx knex migrate:latest");
    fastify.log.info("  - Rollback: npx knex migrate:rollback");
    fastify.log.info("  - Seeds: npx knex seed:run");
  } catch (error) {
    fastify.log.error("❌ Falha ao conectar com o banco de dados:");
    fastify.log.error(error.message);
    throw error;
  }
}

module.exports = fp(knexConnector, {
  name: "knex-connector",
  dependencies: ["@fastify/env"],
});
