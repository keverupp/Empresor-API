// YYYYMMDDHHMMSS_add_unique_constraint_to_document_number_in_companies.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable("companies", function (table) {
    // Adiciona uma restrição de unicidade à coluna document_number.
    // É uma boa prática nomear a restrição explicitamente.
    // Se a coluna já foi criada com .unique(), esta operação pode ser redundante
    // ou o Knex/banco de dados pode lidar com isso (geralmente resultando em erro se já existe).
    // Esta forma é para adicionar a restrição a uma coluna existente que não a possui.
    table.unique(["document_number"], {
      indexName: "companies_document_number_unique_idx",
    });
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable("companies", function (table) {
    // Remove a restrição de unicidade. O nome do índice/restrição deve corresponder.
    table.dropUnique(
      ["document_number"],
      "companies_document_number_unique_idx"
    );
  });
};
