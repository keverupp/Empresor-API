// YYYYMMDDHHMMSS_create_companies_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("companies", function (table) {
    table.increments("id").primary(); // Chave primária autoincrementável

    table.integer("owner_id").unsigned().notNullable();
    // Se o usuário proprietário for deletado, suas empresas também são.
    // Ajuste onDelete para 'SET NULL' ou 'RESTRICT' se precisar de outro comportamento.
    table
      .foreign("owner_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    table.string("name", 255).notNullable(); // Nome fantasia ou nome de exibição
    table.string("legal_name", 255).nullable(); // Razão Social
    table.string("document_number", 50).nullable().unique(); // CNPJ, CPF (se aplicável), etc.
    table.string("email", 255).nullable(); // E-mail de contato da empresa
    table.string("phone_number", 50).nullable(); // Telefone de contato da empresa

    // Endereço
    table.string("address_street", 255).nullable();
    table.string("address_number", 50).nullable();
    table.string("address_complement", 255).nullable();
    table.string("address_neighborhood", 100).nullable(); // Bairro
    table.string("address_city", 100).nullable();
    table.string("address_state", 50).nullable(); // Ou `string(2)` para abreviação (UF)
    table.string("address_zip_code", 20).nullable(); // CEP
    table.string("address_country", 50).nullable().defaultTo("BR");

    table.string("logo_url", 512).nullable(); // URL ou caminho para o logo armazenado

    // Preferências para geração de PDF (orçamentos, relatórios, etc.)
    // Ex: { "template_id": "moderno", "cor_primaria": "#003366", "mostrar_logo_rodape": true }
    table.jsonb("pdf_preferences").nullable().defaultTo("{}");

    table.string("status", 50).notNullable().defaultTo("active"); // Ex: 'active', 'inactive', 'suspended'

    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Índices
    table.index("owner_id");
    table.index("document_number");
    table.index("name"); // Se for buscar empresas por nome frequentemente
    table.index("status");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("companies");
};
