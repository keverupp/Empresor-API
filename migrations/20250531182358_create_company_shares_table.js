// آغازMMDDHHMMSS_create_company_shares_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("company_shares", function (table) {
    table.increments("id").primary();

    table.integer("company_id").unsigned().notNullable();
    table
      .foreign("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");

    table.integer("shared_with_user_id").unsigned().notNullable();
    table
      .foreign("shared_with_user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    table.integer("shared_by_user_id").unsigned().notNullable(); // Geralmente o proprietário da empresa
    table
      .foreign("shared_by_user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    // Permissões do usuário compartilhado para esta empresa específica
    // Ex: { "can_view_clients": true, "can_create_quotes": true, "can_edit_settings": false }
    table.jsonb("permissions").nullable().defaultTo("{}");

    table.string("status", 50).notNullable().defaultTo("active"); // Ex: 'active', 'pending_acceptance', 'revoked'

    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Garante que uma empresa só possa ser compartilhada uma vez com o mesmo usuário
    table.unique(["company_id", "shared_with_user_id"], {
      indexName: "company_shares_company_user_unique_idx",
    });

    // Índices
    table.index("company_id");
    table.index("shared_with_user_id");
    table.index("shared_by_user_id");
    table.index("status");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("company_shares");
};
