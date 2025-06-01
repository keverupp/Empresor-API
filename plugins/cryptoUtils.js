"use strict";

const fp = require("fastify-plugin");
const crypto = require("node:crypto"); // Módulo nativo do Node.js

async function cryptoUtilsPlugin(fastify, opts) {
  fastify.decorate("cryptoUtils", {
    /**
     * Gera uma string hexadecimal aleatória segura.
     * @param {number} bytes Número de bytes para gerar (default: 32).
     * @returns {string} A string hexadecimal.
     */
    generateRandomHexString: (bytes = 32) => {
      return crypto.randomBytes(bytes).toString("hex");
    },
    /**
     * Gera um hash SHA256 para uma string.
     * @param {string} data A string para hashear.
     * @returns {string} O hash em formato hexadecimal.
     */
    hashSha256: (data) => {
      if (!data) throw new Error("Data to hash cannot be empty");
      return crypto.createHash("sha256").update(data).digest("hex");
    },
    // Você pode adicionar outras funções utilitárias do crypto aqui conforme necessário
  });
  fastify.log.info("Utilitários crypto carregados.");
}

module.exports = fp(cryptoUtilsPlugin, {
  name: "crypto-utils",
});
