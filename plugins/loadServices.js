"use strict";

const fp = require("fastify-plugin");
const path = require("node:path");
const fs = require("node:fs"); // Usaremos a versão síncrona para simplicidade no boot

async function serviceLoaderPlugin(fastify, opts) {
  const services = {};
  const servicesPath = opts.servicesPath || path.join(__dirname, "../services"); // Caminho para a pasta 'services'

  try {
    if (fs.existsSync(servicesPath)) {
      const files = fs.readdirSync(servicesPath);

      for (const file of files) {
        // Convenção: arquivos terminam com 'Service.js' (ex: authService.js, userService.js)
        if (file.endsWith("Service.js") && !file.startsWith(".")) {
          // Extrai o nome do serviço do nome do arquivo: 'authService.js' -> 'auth'
          const serviceName = file.substring(0, file.indexOf("Service.js"));

          if (serviceName) {
            try {
              const serviceModule = require(path.join(servicesPath, file));
              services[serviceName] = serviceModule; // Armazena o módulo de serviço inteiro
              fastify.log.info(
                `[ServiceLoader] Serviço '${serviceName}' carregado de ${file}.`
              );
            } catch (err) {
              fastify.log.error(
                err,
                `[ServiceLoader] Erro ao carregar o serviço do arquivo: ${file}`
              );
            }
          }
        }
      }
    } else {
      fastify.log.warn(
        `[ServiceLoader] Diretório de serviços não encontrado: ${servicesPath}`
      );
    }
  } catch (err) {
    fastify.log.error(
      err,
      "[ServiceLoader] Erro ao tentar ler o diretório de serviços."
    );
  }

  fastify.decorate("services", services);
  fastify.log.info(
    "[ServiceLoader] Todos os serviços disponíveis em fastify.services."
  );
}

module.exports = fp(serviceLoaderPlugin, {
  name: "service-loader",
  // Adicione dependências se este plugin depender de outros (ex: 'fastify.config' via @fastify/env)
  // dependencies: []
});
