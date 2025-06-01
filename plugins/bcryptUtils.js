"use strict";

const fp = require("fastify-plugin");
const bcrypt = require("bcryptjs");

// Você pode tornar BCRYPT_SALT_ROUNDS configurável via fastify.config ou opções do plugin
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

async function bcryptUtilsPlugin(fastify, opts) {
  const saltRounds = opts.saltRounds || BCRYPT_SALT_ROUNDS;

  fastify.decorate("bcrypt", {
    hash: async (data) => {
      if (!data) throw new Error("Data to hash cannot be empty");
      return bcrypt.hash(data, saltRounds);
    },
    compare: async (data, encrypted) => {
      if (!data || !encrypted) return false; // Evita erro se um dos valores for nulo/undefined
      return bcrypt.compare(data, encrypted);
    },
  });

  fastify.log.info(
    `Utilitários bcrypt carregados com saltRounds: ${saltRounds}`
  );
}

module.exports = fp(bcryptUtilsPlugin, {
  name: "bcrypt-utils",
  // Se você quiser passar 'saltRounds' ao registrar o plugin manualmente:
  // fastify.register(require('./plugins/bcryptUtils'), { saltRounds: 12 })
  // Mas com autoload, ele usará o BCRYPT_SALT_ROUNDS do .env ou o default 10.
});
