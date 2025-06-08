// services/permissionService.js
"use strict";

class PermissionService {
  async getUserPlan(fastify, userId) {
    const { knex } = fastify;

    // --- CORREÇÃO AQUI ---
    // Construa a query em uma variável antes de executar com 'await'
    const planDetailsQuery = knex("user_plan_subscriptions as ups")
      .join("plans as p", "ups.plan_id", "p.id")
      .select("p.*")
      .where("ups.user_id", userId)
      .whereIn("ups.status", ["active", "trialing", "free"])
      .orderBy("ups.created_at", "desc")
      .first();

    // Execute a query construída com 'await' no final
    const planDetails = await planDetailsQuery;

    return planDetails || null;
  }

  /**
   * Verifica se o plano de um usuário permite uma determinada ação.
   * @param {object} userPlan - O objeto do plano obtido de `getUserPlan`.
   * @param {string} permissionFlag - O nome da coluna de permissão booleana na tabela 'plans'.
   * @returns {boolean}
   */
  checkPermission(userPlan, permissionFlag) {
    // Se não há plano ou a flag não existe/é falsa, a permissão é negada.
    if (!userPlan || !userPlan[permissionFlag]) {
      return false;
    }
    return true;
  }

  /**
   * Verifica se um usuário excedeu um limite numérico de seu plano.
   * @param {object} userPlan - O objeto do plano obtido de `getUserPlan`.
   * @param {string} limitName - O nome da coluna de limite na tabela 'plans'.
   * @param {number} currentValue - O valor atual que está sendo verificado contra o limite.
   * @returns {boolean} - Retorna `true` se o limite foi excedido, `false` caso contrário.
   */
  checkLimit(userPlan, limitName, currentValue) {
    // Se não há plano, consideramos o limite como 0 (o mais restritivo).
    const limit = userPlan ? userPlan[limitName] : 0;

    // Se o limite for null ou undefined, consideramos como ilimitado.
    if (limit === null || limit === undefined) {
      return false; // Não excedeu o limite
    }

    if (currentValue >= limit) {
      return true; // Excedeu o limite
    }

    return false; // Não excedeu o limite
  }
}

module.exports = new PermissionService();
