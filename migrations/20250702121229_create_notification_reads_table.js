// migrations/20250702120100_create_notification_reads_table.js

/**
 * Migration para criar a tabela de controle de leitura de notificações
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("notification_reads", function (table) {
    table.increments("id").primary();

    // Referência para a notificação
    table.integer("notification_id").unsigned().notNullable();
    table
      .foreign("notification_id")
      .references("id")
      .inTable("notifications")
      .onDelete("CASCADE");

    // Usuário que leu a notificação
    table.integer("user_id").unsigned().notNullable();
    table
      .foreign("user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    // Status da leitura
    table.string("read_status", 50).notNullable().defaultTo("read"); // 'read', 'archived', 'starred'

    // Metadados opcionais (ex: dispositivo usado, localização, etc.)
    table.jsonb("metadata").nullable().defaultTo("{}");

    // Controle de timestamps
    table.timestamp("read_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Garantir que um usuário só pode ter um registro de leitura por notificação
    table.unique(["notification_id", "user_id"], {
      indexName: "notification_reads_notification_user_unique_idx",
    });

    // Índices para otimização de consultas
    table.index("notification_id");
    table.index("user_id");
    table.index("read_status");
    table.index("read_at");

    // Índices compostos para consultas comuns
    table.index(["user_id", "read_status"]);
    table.index(["user_id", "read_at"]);
    table.index(["notification_id", "read_status"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("notification_reads");
};
