// YYYYMMDDHHMMSS_add_validation_fields_to_companies.js

/**
 * @param {import("knex").Knex} knex
 */
exports.up = function (knex) {
  return knex.schema.alterTable("companies", (table) => {
    // Adiciona o código de validação. Pode ser nulo.
    table.string("validation_code", 10).nullable();

    // Adiciona o timestamp de expiração do código. Também pode ser nulo.
    table.timestamp("validation_code_expires_at").nullable();
  });
};

/**
 * @param {import("knex").Knex} knex
 */
exports.down = function (knex) {
  // A função 'down' reverte as alterações, removendo as colunas.
  return knex.schema.alterTable("companies", (table) => {
    table.dropColumn("validation_code");
    table.dropColumn("validation_code_expires_at");
  });
};
