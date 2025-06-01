// آغازMMDDHHMMSS_create_company_text_templates_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("company_text_templates", function (table) {
    table.increments("id").primary();

    table.integer("company_id").unsigned().notNullable();
    table
      .foreign("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");

    table.string("template_name", 255).notNullable();
    table.string("template_type", 50).notNullable(); // Ex: TERMS_OF_SERVICE, GENERAL_NOTES, PAYMENT_METHODS, VALIDITY_INFO
    table.text("content").notNullable();
    table.boolean("is_default").notNullable().defaultTo(false);

    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    table.unique(["company_id", "template_name"], {
      indexName: "company_text_templates_company_name_unique_idx",
    });
    table.index("company_id");
    table.index("template_type");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("company_text_templates");
};
