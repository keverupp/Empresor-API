// SEU ARQUIVO: plugins/crypto-utils.js (ou similar)

"use strict";

const fp = require("fastify-plugin");
const crypto = require("node:crypto");

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

    // ***** NOVA FUNÇÃO ADICIONADA *****
    /**
     * Gera um código numérico aleatório com um número específico de dígitos.
     * É seguro e compatível com todas as versões do Node.js.
     * @param {number} digits O número de dígitos para o código (padrão: 6).
     * @returns {string} O código numérico como string.
     */
    generateNumericCode: (digits = 6) => {
      const max = 10 ** digits;
      const min = 10 ** (digits - 1);
      const range = max - min;

      // Gera um número aleatório seguro e o ajusta para o intervalo desejado.
      const randomNumber = crypto.randomBytes(4).readUInt32BE(0);
      return (min + (randomNumber % range)).toString();
    },
    // **********************************
  });
  fastify.log.info("Utilitários crypto carregados.");
}

module.exports = fp(cryptoUtilsPlugin, {
  name: "crypto-utils",
});
