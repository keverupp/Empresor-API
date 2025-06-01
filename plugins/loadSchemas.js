"use strict";

const fp = require("fastify-plugin");
const fs = require("fs");
const path = require("path");

module.exports = fp(
  async function (fastify, opts) {
    const schemasPath = opts.schemasPath || path.join(__dirname, "../schemas");
    const allSharedSchemas = [];

    // Função para carregar schemas recursivamente
    function loadSchemasFromDirectory(dirPath) {
      if (!fs.existsSync(dirPath)) {
        fastify.log.warn(`Diretório de schemas não encontrado: ${dirPath}`);
        return;
      }

      const files = fs.readdirSync(dirPath);

      files.forEach((file) => {
        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // Recursivamente carrega schemas de subdiretórios
          loadSchemasFromDirectory(filePath);
        } else if (file.endsWith(".js") && !file.startsWith(".")) {
          try {
            const schemaModule = require(filePath);

            // Verifica se o módulo tem sharedSchemas
            if (
              schemaModule.sharedSchemas &&
              Array.isArray(schemaModule.sharedSchemas)
            ) {
              allSharedSchemas.push(...schemaModule.sharedSchemas);
              fastify.log.debug(`Schemas carregados de: ${filePath}`);
            }
          } catch (error) {
            fastify.log.error({
              msg: `Erro ao carregar schema do arquivo: ${filePath}`,
              error: error.message,
            });
          }
        }
      });
    }

    // Carrega todos os schemas da pasta
    loadSchemasFromDirectory(schemasPath);

    // Registra todos os schemas encontrados
    let schemasRegistered = 0;
    let schemasSkipped = 0;

    allSharedSchemas.forEach((schema) => {
      if (schema.$id) {
        if (!fastify.getSchema(schema.$id)) {
          fastify.addSchema(schema);
          schemasRegistered++;
        } else {
          fastify.log.debug(`Schema ${schema.$id} já existe, pulando...`);
          schemasSkipped++;
        }
      } else {
        fastify.log.warn({
          msg: "Schema compartilhado sem $id não pode ser adicionado.",
          schema,
        });
        schemasSkipped++;
      }
    });

    // Log do resultado
    if (schemasRegistered > 0) {
      fastify.log.info(
        `${schemasRegistered} schemas compartilhados carregados automaticamente.`
      );
    }

    if (schemasSkipped > 0) {
      fastify.log.info(`${schemasSkipped} schemas foram pulados.`);
    }

    if (schemasRegistered === 0 && schemasSkipped === 0) {
      fastify.log.info("Nenhum schema compartilhado encontrado para carregar.");
    }
  },
  {
    name: "load-schemas-autoload",
    // Se este plugin depender de outros, adicione aqui. Ex: dependencies: ['@fastify/env']
  }
);
