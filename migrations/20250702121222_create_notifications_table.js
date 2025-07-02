// migrations/20250702120000_create_notifications_table.js

/**
 * Migration para criar a tabela de notificações
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("notifications", function (table) {
    table.increments("id").primary();

    // UUID público para referência externa (seguindo padrão do projeto)
    table
      .uuid("public_id")
      .unique()
      .notNullable()
      .defaultTo(knex.raw("gen_random_uuid()"));

    // Tipo da notificação
    table.string("type", 100).notNullable(); // Ex: 'system_update', 'payment_reminder', 'feature_announcement', 'maintenance'

    // Título e conteúdo da notificação
    table.string("title", 255).notNullable();
    table.text("content").notNullable();

    // Dados adicionais em JSON (ex: URLs, ações, metadados)
    table.jsonb("metadata").nullable().defaultTo("{}");

    // URL de ação opcional (para redirects ou ações específicas)
    table.string("action_url", 512).nullable();

    // Prioridade da notificação
    table.string("priority", 50).notNullable().defaultTo("normal"); // 'low', 'normal', 'high', 'urgent'

    // Destinatário da notificação
    table.integer("target_user_id").unsigned().nullable(); // NULL = notificação global
    table
      .foreign("target_user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    // Empresa específica (opcional, para notificações relacionadas a empresas)
    table.integer("target_company_id").unsigned().nullable();
    table
      .foreign("target_company_id")
      .references("id")
      .inTable("companies")
      .onDelete("CASCADE");

    // Quem criou a notificação (normalmente admin/sistema)
    table.integer("created_by_user_id").unsigned().nullable();
    table
      .foreign("created_by_user_id")
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");

    // Data de expiração (opcional)
    table.timestamp("expires_at", { useTz: true }).nullable();

    // Status da notificação
    table.string("status", 50).notNullable().defaultTo("active"); // 'active', 'expired', 'disabled'

    // Controle de timestamps
    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Índices para otimização de consultas
    table.index("public_id");
    table.index("type");
    table.index("target_user_id");
    table.index("target_company_id");
    table.index("status");
    table.index("priority");
    table.index("expires_at");
    table.index("created_at");

    // Índices compostos para consultas comuns
    table.index(["target_user_id", "status"]);
    table.index(["status", "expires_at"]);
    table.index(["type", "status"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("notifications");
};
