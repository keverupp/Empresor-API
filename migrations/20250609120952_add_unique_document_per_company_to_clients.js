// migrations/20250609120952_add_unique_document_per_company_to_clients.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  // Usando knex.raw para garantir a sintaxe correta do PostgreSQL para um índice único parcial
  return knex.raw(`
      CREATE UNIQUE INDEX clients_company_document_unique_idx
      ON clients (company_id, document_number)
      WHERE document_number IS NOT NULL;
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  // Usando knex.raw para remover o índice de forma segura
  return knex.raw("DROP INDEX IF EXISTS clients_company_document_unique_idx;");
};
