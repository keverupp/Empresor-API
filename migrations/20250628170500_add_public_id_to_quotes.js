/**
 * Migration to add public_id UUID column to quotes
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable("quotes", function (table) {
    table
      .uuid("public_id")
      .unique()
      .notNullable()
      .defaultTo(knex.raw("gen_random_uuid()"));
    table.index("public_id");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable("quotes", function (table) {
    table.dropIndex("public_id");
    table.dropColumn("public_id");
  });
};
