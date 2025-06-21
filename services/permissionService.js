// services/permissionService.js
"use strict";

class PermissionService {
  async getUserPlan(fastify, userId) {
    const { knex } = fastify;

    // Busca o plano ativo do usuário com todas as informações
    const planDetailsQuery = knex("user_plan_subscriptions as ups")
      .join("plans as p", "ups.plan_id", "p.id")
      .select("p.*") // Pega todas as colunas da tabela plans
      .where("ups.user_id", userId)
      .whereIn("ups.status", ["active", "trialing", "free"])
      .orderBy("ups.created_at", "desc")
      .first();

    const planDetails = await planDetailsQuery;

    // Se não encontrou plano, retorna null
    if (!planDetails) {
      return null;
    }

    // ⚠️ CORREÇÃO CRÍTICA: Parse do JSONB features
    // O PostgreSQL pode retornar o JSONB como string ou objeto dependendo do driver
    let features = planDetails.features;

    if (typeof features === "string") {
      try {
        features = JSON.parse(features);
      } catch (error) {
        fastify.log.error(
          `Erro ao fazer parse do features do plano ${planDetails.id}:`,
          error
        );
        features = {}; // Fallback para objeto vazio
      }
    }

    // Garante que features é um objeto
    if (!features || typeof features !== "object") {
      features = {};
    }

    // Retorna o plano com features já parseado
    return {
      ...planDetails,
      features: features,
    };
  }

  /**
   * Verifica se o plano de um usuário permite uma determinada ação.
   * @param {object} userPlan - O objeto do plano obtido de `getUserPlan`.
   * @param {string} permissionFlag - O nome da permissão no objeto features.
   * @returns {boolean}
   */
  checkPermission(userPlan, permissionFlag) {
    // Se não há plano, a permissão é negada
    if (!userPlan) {
      return false;
    }

    // Garante que features existe e é um objeto
    const features = userPlan.features || {};

    // Verifica se a permissão específica existe e é verdadeira
    const hasPermission = Boolean(features[permissionFlag]);

    return hasPermission;
  }

  /**
   * Verifica se um usuário excedeu um limite numérico de seu plano.
   * @param {object} userPlan - O objeto do plano obtido de `getUserPlan`.
   * @param {string} limitName - O nome do limite no objeto features.
   * @param {number} currentValue - O valor atual que está sendo verificado contra o limite.
   * @returns {boolean} - Retorna `true` se o limite foi excedido, `false` caso contrário.
   */
  checkLimit(userPlan, limitName, currentValue) {
    // Se não há plano, consideramos o limite como 0 (o mais restritivo)
    if (!userPlan) {
      return true; // Sem plano = limite excedido
    }

    // Garante que features existe e é um objeto
    const features = userPlan.features || {};

    // Obtém o limite específico
    const limit = features[limitName];

    // Se o limite for null, undefined ou -1, consideramos como ilimitado
    if (limit === null || limit === undefined || limit === -1) {
      return false; // Não excedeu o limite (ilimitado)
    }

    // Converte para número para garantir comparação correta
    const numericLimit = Number(limit);
    const numericCurrent = Number(currentValue);

    // Se não conseguir converter, considera limite excedido por segurança
    if (isNaN(numericLimit) || isNaN(numericCurrent)) {
      return true;
    }

    // Verifica se excedeu o limite
    return numericCurrent >= numericLimit;
  }

  /**
   * Método de debug para verificar o conteúdo do plano
   * @param {object} userPlan
   * @returns {object}
   */
  debugPlan(userPlan) {
    if (!userPlan) {
      return { error: "Nenhum plano fornecido" };
    }

    return {
      planId: userPlan.id,
      planName: userPlan.name,
      features: userPlan.features,
      featuresType: typeof userPlan.features,
      featuresKeys: userPlan.features ? Object.keys(userPlan.features) : [],
    };
  }
}

module.exports = new PermissionService();
