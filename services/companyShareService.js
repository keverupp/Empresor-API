"use strict";

class CompanyShareService {
  async _resolveCompanyId(knex, identifier) {
    const row = await knex("companies")
      .select("id")
      .where("public_id", identifier)
      .first();
    return row ? row.id : null;
  }
  async createShare(fastify, owner, companyId, recipientEmail, permissions) {
    const { knex, log, services } = fastify;
    const companyInternalId = await this._resolveCompanyId(knex, companyId);
    const { permission: PermissionService } = services;

    if (owner.email === recipientEmail) {
      const error = new Error(
        "Você não pode compartilhar uma empresa com você mesmo."
      );
      error.statusCode = 400;
      throw error;
    }

    const recipient = await knex("users")
      .where({ email: recipientEmail })
      .first();
    if (!recipient) {
      const error = new Error("Usuário destinatário não encontrado.");
      error.statusCode = 404;
      throw error;
    }

    const existingShare = await knex("company_shares")
      .where({ company_id: companyInternalId, shared_with_user_id: recipient.id })
      .first();
    if (existingShare) {
      const error = new Error(
        "Esta empresa já está compartilhada com este usuário."
      );
      error.statusCode = 409;
      throw error;
    }

    const ownerPlan = await PermissionService.getUserPlan(fastify, owner.id);
    const recipientPlan = await PermissionService.getUserPlan(
      fastify,
      recipient.id
    );

    const ownerShareCountResult = await knex("company_shares")
      .where({ company_id: companyInternalId })
      .count("id as total")
      .first();
    if (
      PermissionService.checkLimit(
        ownerPlan,
        "max_shares_per_company",
        ownerShareCountResult.total
      )
    ) {
      const error = new Error(
        "Limite de compartilhamentos para esta empresa atingido, de acordo com o seu plano."
      );
      error.statusCode = 422;
      throw error;
    }

    const recipientShareCountResult = await knex("company_shares")
      .where({ shared_with_user_id: recipient.id })
      .count("id as total")
      .first();
    if (
      PermissionService.checkLimit(
        recipientPlan,
        "max_shares_for_user",
        recipientShareCountResult.total
      )
    ) {
      const error = new Error(
        "O usuário destinatário atingiu o limite de empresas compartilhadas, de acordo com o plano dele."
      );
      error.statusCode = 422;
      throw error;
    }

    const shareToInsert = {
      company_id: companyInternalId,
      shared_with_user_id: recipient.id,
      shared_by_user_id: owner.id,
      permissions: permissions || {},
      status: "active", // Ou 'pending_acceptance' se você implementar um fluxo de convite
    };

    const [newShare] = await knex("company_shares")
      .insert(shareToInsert)
      .returning("*");

    log.info(
      `Empresa ${companyId} compartilhada com sucesso com o usuário ${recipient.id}.`
    );

    return {
      share_id: newShare.id,
      user_id: recipient.id,
      name: recipient.name,
      email: recipient.email,
      permissions: newShare.permissions,
      status: newShare.status,
      shared_at: newShare.created_at,
    };
  }

  async listShares(fastify, companyId) {
    const companyInternalId = await this._resolveCompanyId(
      fastify.knex,
      companyId
    );
    return fastify
      .knex("company_shares as cs")
      .join("users as u", "cs.shared_with_user_id", "u.id")
      .where("cs.company_id", companyInternalId)
      .select(
        "cs.id as share_id",
        "u.id as user_id",
        "u.name",
        "u.email",
        "cs.permissions",
        "cs.status",
        "cs.created_at as shared_at"
      );
  }

  async deleteShare(fastify, companyId, sharedUserId) {
    const companyInternalId = await this._resolveCompanyId(
      fastify.knex,
      companyId
    );
    const result = await fastify
      .knex("company_shares")
      .where({
        company_id: companyInternalId,
        shared_with_user_id: sharedUserId, // Corrigido para a nova coluna
      })
      .del();

    if (result === 0) {
      const error = new Error("Registro de compartilhamento não encontrado.");
      error.statusCode = 404;
      throw error;
    }

    fastify.log.info(
      `Compartilhamento da empresa ${companyId} com o usuário ${sharedUserId} removido.`
    );
    return { message: "Compartilhamento removido com sucesso." };
  }
}

module.exports = new CompanyShareService();
