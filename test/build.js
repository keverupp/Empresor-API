const Fastify = require('fastify');
const appService = require('../server');

async function build() {
  const fastify = Fastify({ logger: false });
  await fastify.register(appService);
  await fastify.ready();
  return fastify;
}
module.exports = build;
