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

  async listCompaniesSharedWithUser(fastify, userId) {
    const rows = await fastify
      .knex("company_shares as cs")
      .join("companies as c", "cs.company_id", "c.id")
      .join("users as owner", "c.owner_id", "owner.id")
      .join("users as shared_by", "cs.shared_by_user_id", "shared_by.id")
      .where("cs.shared_with_user_id", userId)
      .select(
        "cs.id as share_id",
        "cs.permissions",
        "cs.status",
        "cs.created_at as shared_at",
        "c.id as company_internal_id",
        "c.public_id as company_public_id",
        "c.name as company_name",
        "c.status as company_status",
        "owner.id as owner_id",
        "owner.public_id as owner_public_id",
        "owner.name as owner_name",
        "owner.email as owner_email",
        "shared_by.id as shared_by_id",
        "shared_by.public_id as shared_by_public_id",
        "shared_by.name as shared_by_name",
        "shared_by.email as shared_by_email"
      )
      .orderBy("cs.created_at", "desc");

    const resolveId = (primary, fallback) => {
      if (primary !== undefined && primary !== null && primary !== "") {
        return String(primary);
      }
      if (fallback !== undefined && fallback !== null && fallback !== "") {
        return String(fallback);
      }
      return null;
    };

    return rows.map((row) => {
      const companyId = resolveId(
        row.company_public_id,
        row.company_internal_id
      );
      return {
        share_id: row.share_id,
        permissions: row.permissions || {},
        status: row.status,
        shared_at: row.shared_at,
        company: {
          id: companyId,
          name: row.company_name,
          status: row.company_status,
          owner: {
            id: resolveId(row.owner_public_id, row.owner_id),
            name: row.owner_name || null,
            email: row.owner_email || null,
          },
        },
        shared_by: {
          id: resolveId(row.shared_by_public_id, row.shared_by_id),
          name: row.shared_by_name || null,
          email: row.shared_by_email || null,
        },
      };
    });
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
