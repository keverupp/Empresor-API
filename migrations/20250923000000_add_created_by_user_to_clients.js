"use strict";

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.alterTable("clients", function (table) {
    table
      .integer("created_by_user_id")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL");
    table.index("created_by_user_id");
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.alterTable("clients", function (table) {
    table.dropIndex("created_by_user_id");
    table.dropColumn("created_by_user_id");
  });
};
