// YYYYMMDDHHMMSS_create_plans_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("plans", function (table) {
    table.increments("id").primary();
    table.string("name", 100).notNullable().unique(); // Ex: 'Gratuito', 'Pro', 'Empresarial'
    table.text("description").nullable();
    table.integer("price_cents").nullable(); // Preço em centavos
    table.string("price_currency", 3).nullable().defaultTo("BRL");
    table.string("billing_cycle", 50).nullable(); // Ex: 'monthly', 'annually'

    // Armazena limites e flags de funcionalidades.
    // Ex: { "max_quotes_per_month": 100, "allow_product_catalog": true, ... }
    table.jsonb("features").notNullable().defaultTo("{}");

    table.boolean("is_active").notNullable().defaultTo(true); // Para desativar planos antigos

    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Índices
    table.index("name");
    table.index("is_active");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("plans");
};
