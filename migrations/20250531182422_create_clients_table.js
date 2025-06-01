// آغازMMDDHHMMSS_create_clients_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("clients", function (table) {
    table.increments("id").primary();

    table.integer("company_id").unsigned().notNullable();
    table
      .foreign("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE"); // Clientes pertencem a uma empresa

    table.string("name", 255).notNullable();
    table.string("email", 255).nullable(); // Pode ser único por empresa (lógica na aplicação ou índice composto)
    table.string("phone_number", 50).nullable();
    table.string("document_number", 50).nullable(); // CPF/CNPJ do cliente

    // Endereço simplificado do cliente
    table.string("address_street", 255).nullable();
    table.string("address_city", 100).nullable();
    table.string("address_state", 50).nullable();
    table.string("address_zip_code", 20).nullable();

    table.text("notes").nullable(); // Observações sobre o cliente

    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Índices
    table.index("company_id");
    table.index("name");
    // Se e-mail ou document_number forem frequentemente usados para busca dentro de uma empresa:
    // table.index(['company_id', 'email']);
    // table.index(['company_id', 'document_number']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("clients");
};
