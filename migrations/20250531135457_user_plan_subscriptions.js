// YYYYMMDDHHMMSS_create_user_plan_subscriptions_table.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("user_plan_subscriptions", function (table) {
    table.increments("id").primary();

    table.integer("user_id").unsigned().notNullable();
    table
      .foreign("user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE"); // CASCADE: se o usuário for deletado, suas assinaturas também são.

    table.integer("plan_id").unsigned().notNullable();
    table
      .foreign("plan_id")
      .references("id")
      .inTable("plans")
      .onDelete("RESTRICT"); // RESTRICT: impede deletar um plano se ele estiver em uso por alguma assinatura.

    table.string("status", 50).notNullable(); // Ex: 'trialing', 'active', 'past_due', 'canceled', 'expired', 'free'

    table.timestamp("started_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("trial_ends_at", { useTz: true }).nullable();
    table.timestamp("current_period_ends_at", { useTz: true }).nullable(); // Fim do período atual (pago ou trial)
    table.timestamp("canceled_at", { useTz: true }).nullable(); // Quando o usuário solicitou cancelamento
    table.timestamp("ended_at", { useTz: true }).nullable(); // Quando a assinatura efetivamente terminou

    table.jsonb("metadata").nullable(); // Para dados extras, como ID de pagamento, etc.

    table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now());

    // Índices
    table.index("user_id");
    table.index("plan_id");
    table.index("status");
    table.index(["user_id", "status"]); // Índice composto pode ser útil
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTableIfExists("user_plan_subscriptions");
};
