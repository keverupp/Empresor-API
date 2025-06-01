// آغازMMDDHHMMSS_create_products_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("products", function (table) {
    table.increments("id").primary();

    table.integer("company_id").unsigned().notNullable();
    table
      .foreign("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE"); // Produtos pertencem a uma empresa

    table.string("name", 255).notNullable();
    table.text("description").nullable();
    table.string("sku", 100).nullable(); // Stock Keeping Unit (Código do produto)

    table.bigInteger("unit_price_cents").nullable().defaultTo(0); // Preço unitário padrão em centavos
    table.string("unit", 50).nullable(); // Unidade de medida (ex: 'un', 'hr', 'kg', 'serviço')

    table.boolean("is_active").notNullable().defaultTo(true); // Para ativar/desativar produtos

    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Índices
    table.index("company_id");
    table.index("name");
    // Se SKU for usado e precisar ser único por empresa:
    table.unique(["company_id", "sku"], {
      indexName: "products_company_id_sku_unique_idx",
    });
    table.index("is_active");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("products");
};
