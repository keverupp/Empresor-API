// 20250531135228_create_user_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  // >>> GARANTA QUE ESTE 'return' ESTÁ PRESENTE <<<
  return knex.schema.createTable("users", function (table) {
    table.increments("id").primary();
    table.string("name", 255).notNullable();
    table.string("email", 255).notNullable().unique();
    table.string("password_hash", 255).notNullable();
    table.text("refresh_token").nullable();
    table.string("google_id", 255).nullable().unique();
    table.string("role", 50).notNullable().defaultTo("user");
    table.string("status", 50).notNullable().defaultTo("active");
    table.string("password_reset_token", 255).nullable();
    table.timestamp("password_reset_expires", { useTz: true }).nullable();
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    table.index("email");
    table.index("google_id");
    table.index("role");
    table.index("status");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  // >>> GARANTA QUE ESTE 'return' ESTÁ PRESENTE <<<
  return knex.schema.dropTableIfExists("users");
};
