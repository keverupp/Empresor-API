/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.table("quote_items", function (table) {
    table.text("complement").nullable();
    table.jsonb("images").nullable().defaultTo(JSON.stringify([]));
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table("quote_items", function (table) {
    table.dropColumn("complement");
    table.dropColumn("images");
  });
};
