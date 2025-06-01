// آغازMMDDHHMMSS_create_quote_items_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("quote_items", function (table) {
    table.increments("id").primary();

    table.integer("quote_id").unsigned().notNullable();
    table
      .foreign("quote_id")
      .references("id")
      .inTable("quotes")
      .onDelete("CASCADE"); // Itens pertencem a um orçamento

    table.integer("product_id").unsigned().nullable();
    // Se o produto for deletado do catálogo, o item do orçamento ainda existe, mas sem o link.
    table
      .foreign("product_id")
      .references("id")
      .inTable("products")
      .onDelete("SET NULL");

    table.text("description").notNullable(); // Descrição do produto/serviço (pode vir do catálogo ou ser customizada)
    table.decimal("quantity", 10, 2).notNullable().defaultTo(1.0); // Quantidade (ex: 1.5 horas)
    table.bigInteger("unit_price_cents").notNullable().defaultTo(0); // Preço unitário em centavos no momento da cotação
    table.bigInteger("total_price_cents").notNullable().defaultTo(0); // quantity * unit_price_cents (armazenado para histórico)

    table.integer("item_order").nullable(); // Para ordenação dos itens no orçamento

    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Índices
    table.index("quote_id");
    table.index("product_id");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("quote_items");
};
