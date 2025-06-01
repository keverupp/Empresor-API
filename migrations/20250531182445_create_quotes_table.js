// آغازMMDDHHMMSS_create_quotes_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("quotes", function (table) {
    table.increments("id").primary();

    table.integer("company_id").unsigned().notNullable();
    table
      .foreign("company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");

    table.integer("client_id").unsigned().notNullable();
    table
      .foreign("client_id")
      .references("id")
      .inTable("clients")
      .onDelete("RESTRICT"); // Impede deletar cliente se tiver orçamentos

    table.integer("created_by_user_id").unsigned().nullable(); // Usuário que criou o orçamento
    table
      .foreign("created_by_user_id")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL"); // Mantém o orçamento se o usuário for deletado

    // Número do orçamento (unicidade por empresa geralmente é tratada na aplicação)
    table.string("quote_number", 50).notNullable();

    table.string("status", 50).notNullable().defaultTo("draft"); // Ex: 'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'invoiced'
    table.date("issue_date").notNullable().defaultTo(knex.fn.now()); // Data de emissão
    table.date("expiry_date").nullable(); // Data de validade

    table.text("notes").nullable(); // Observações para o cliente
    table.text("internal_notes").nullable(); // Observações internas

    // Valores monetários em centavos para evitar problemas com ponto flutuante
    table.bigInteger("subtotal_cents").notNullable().defaultTo(0);
    table.string("discount_type", 20).nullable(); // 'percentage', 'fixed_amount'
    table.bigInteger("discount_value_cents").nullable().defaultTo(0); // Valor do desconto ou base para percentual
    // Se usar imposto como percentual:
    // table.string('tax_name', 50).nullable();
    // table.decimal('tax_rate_percentage', 5, 2).nullable(); // Ex: 5.00 para 5%
    // Ou, se for um valor fixo de imposto:
    table.bigInteger("tax_amount_cents").nullable().defaultTo(0);
    table.bigInteger("total_amount_cents").notNullable().defaultTo(0);

    table.string("currency", 3).notNullable().defaultTo("BRL");
    table.string("pdf_url", 512).nullable(); // Link para o PDF do orçamento gerado

    table.timestamp("accepted_at", { useTz: true }).nullable(); // Data de aceite
    table.timestamp("rejected_at", { useTz: true }).nullable(); // Data de rejeição

    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Índices
    table.index("company_id");
    table.index("client_id");
    table.index("created_by_user_id");
    table.index("status");
    table.index("quote_number"); // Pode ser útil, mas a unicidade real é mais complexa
    table.index("issue_date");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("quotes");
};
