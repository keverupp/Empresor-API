// آغازMMDDHHMMSS_add_terms_content_to_quotes_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable("quotes", function (table) {
    table
      .text("terms_and_conditions_content")
      .nullable()
      .after("internal_notes"); // Ou ajuste a posição com .after()
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable("quotes", function (table) {
    table.dropColumn("terms_and_conditions_content");
  });
};
