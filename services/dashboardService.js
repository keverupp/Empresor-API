// services/dashboardService.js
"use strict";

class DashboardService {
  /**
   * Função utilitária para validar e extrair dados do usuário
   */
  static _validateUser(fastify, user) {
    // O hook authPlanHook já adiciona as informações do plano em request.user.plan
    const userPlan = user.plan || null;
    const userId = user ? user.userId || user.id : null;

    if (!userId) {
      throw fastify.httpErrors.unauthorized("Usuário não autenticado");
    }

    // Se não há plano, tratamos como usuário comum (não admin)
    const isAdmin = user.role === "admin";

    return { userPlan, userId, isAdmin };
  }

  /**
   * Resumo geral dos orçamentos
   */
  static async getSummary(fastify, user) {
    try {
      const { userPlan, userId, isAdmin } = this._validateUser(fastify, user);

      // Query base considerando permissões do usuário
      let baseQuery = fastify
        .knex("quotes as q")
        .leftJoin("companies as c", "q.company_id", "c.id")
        .leftJoin("clients as cl", "q.client_id", "cl.id");

      // Aplicar filtros baseados no plano do usuário
      // Admin vê tudo, usuários comuns apenas suas empresas
      if (!isAdmin) {
        baseQuery = baseQuery.where("c.owner_id", userId);
      }

      // Estatísticas gerais
      const totalStats = await baseQuery
        .clone()
        .select(
          fastify.knex.raw("COUNT(*) as total_quotations"),
          fastify.knex.raw(
            "COALESCE(SUM(q.total_amount_cents), 0) as total_value_cents"
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as draft_quotations",
            ["draft"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as sent_quotations",
            ["sent"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as viewed_quotations",
            ["viewed"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as accepted_quotations",
            ["accepted"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as rejected_quotations",
            ["rejected"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as expired_quotations",
            ["expired"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as invoiced_quotations",
            ["invoiced"]
          ),
          fastify.knex.raw(
            "COALESCE(SUM(CASE WHEN q.status IN (?, ?) THEN q.total_amount_cents END), 0) as accepted_value_cents",
            ["accepted", "invoiced"]
          )
        )
        .first();

      // Estatísticas mensais dos últimos 12 meses
      const monthlyStats = await baseQuery
        .clone()
        .select(
          fastify.knex.raw("TO_CHAR(q.created_at, 'YYYY-MM') as month"),
          fastify.knex.raw("EXTRACT(YEAR FROM q.created_at) as year"),
          fastify.knex.raw("COUNT(*) as count"),
          fastify.knex.raw(
            "COALESCE(SUM(q.total_amount_cents), 0) as value_cents"
          )
        )
        .where(
          "q.created_at",
          ">=",
          fastify.knex.raw("NOW() - INTERVAL '12 months'")
        )
        .groupByRaw(
          "TO_CHAR(q.created_at, 'YYYY-MM'), EXTRACT(YEAR FROM q.created_at)"
        )
        .orderByRaw("TO_CHAR(q.created_at, 'YYYY-MM') DESC");

      return {
        total_quotations: parseInt(totalStats.total_quotations || 0),
        draft_quotations: parseInt(totalStats.draft_quotations || 0),
        sent_quotations: parseInt(totalStats.sent_quotations || 0),
        viewed_quotations: parseInt(totalStats.viewed_quotations || 0),
        accepted_quotations: parseInt(totalStats.accepted_quotations || 0),
        rejected_quotations: parseInt(totalStats.rejected_quotations || 0),
        expired_quotations: parseInt(totalStats.expired_quotations || 0),
        invoiced_quotations: parseInt(totalStats.invoiced_quotations || 0),
        total_value: parseFloat((totalStats.total_value_cents || 0) / 100),
        accepted_value: parseFloat(
          (totalStats.accepted_value_cents || 0) / 100
        ),
        monthly_stats: monthlyStats.map((stat) => ({
          month: stat.month,
          year: parseInt(stat.year),
          count: parseInt(stat.count),
          value: parseFloat((stat.value_cents || 0) / 100),
        })),
      };
    } catch (error) {
      fastify.log.error(
        error,
        "[DashboardService.getSummary] Erro ao buscar resumo"
      );
      throw fastify.httpErrors.internalServerError(
        "Erro ao buscar resumo do dashboard"
      );
    }
  }

  /**
   * Lista orçamentos com filtros
   */
  static async getQuotations(fastify, user, filters = {}) {
    try {
      const { userPlan, userId, isAdmin } = this._validateUser(fastify, user);

      const {
        company_id,
        client_id,
        status,
        date_from,
        date_to,
        value_min,
        value_max,
        page = 1,
        limit = 20,
      } = filters;

      const offset = (page - 1) * limit;

      // Query base
      let query = fastify
        .knex("quotes as q")
        .select(
          "q.public_id as id",
          "q.quote_number",
          "q.status",
          "q.total_amount_cents",
          "q.issue_date",
          "q.expiry_date",
          "q.notes",
          "q.created_at",
          "q.updated_at",
          "c.public_id as company_id",
          "c.name as company_name",
          "cl.public_id as client_id",
          "cl.name as client_name",
          "cl.email as client_email"
        )
        .leftJoin("companies as c", "q.company_id", "c.id")
        .leftJoin("clients as cl", "q.client_id", "cl.id");

      // Aplicar filtros baseados no plano do usuário
      if (!isAdmin) {
        query = query.where("c.owner_id", userId);
      }

      // Aplicar filtros da query
      if (company_id) {
        query = query.where("c.public_id", company_id);
      }

      if (client_id) {
        query = query.where("cl.public_id", client_id);
      }

      if (status) {
        query = query.where("q.status", status);
      }

      if (date_from) {
        query = query.where("q.issue_date", ">=", date_from);
      }

      if (date_to) {
        query = query.where("q.issue_date", "<=", date_to);
      }

      if (value_min) {
        query = query.where("q.total_amount_cents", ">=", value_min * 100);
      }

      if (value_max) {
        query = query.where("q.total_amount_cents", "<=", value_max * 100);
      }

      // Contar total para paginação
      const countQuery = query
        .clone()
        .clearSelect()
        .count("* as total")
        .first();
      const { total } = await countQuery;

      // Buscar dados paginados
      const quotations = await query
        .orderBy("q.created_at", "desc")
        .limit(limit)
        .offset(offset);

      // Formatar resposta
      const formattedData = quotations.map((q) => ({
        id: q.id,
        quote_number: q.quote_number,
        status: q.status,
        notes: q.notes,
        total_amount_cents: parseInt(q.total_amount_cents || 0),
        issue_date: q.issue_date,
        expiry_date: q.expiry_date,
        created_at: q.created_at,
        updated_at: q.updated_at,
        company: q.company_id
          ? {
              id: q.company_id,
              name: q.company_name,
            }
          : null,
        client: q.client_id
          ? {
              id: q.client_id,
              name: q.client_name,
              email: q.client_email,
            }
          : null,
      }));

      return {
        data: formattedData,
        pagination: {
          page,
          limit,
          total: parseInt(total),
          total_pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      fastify.log.error(
        error,
        "[DashboardService.getQuotations] Erro ao buscar orçamentos"
      );
      throw fastify.httpErrors.internalServerError("Erro ao buscar orçamentos");
    }
  }

  /**
   * Estatísticas por empresa
   */
  static async getCompanyStats(fastify, user, filters = {}) {
    try {
      const { userPlan, userId, isAdmin } = this._validateUser(fastify, user);
      const { date_from, date_to } = filters;

      let query = fastify
        .knex("quotes as q")
        .select(
          "c.id as company_id",
          "c.name as company_name",
          fastify.knex.raw("COUNT(*) as total_quotations"),
          fastify.knex.raw(
            "COALESCE(SUM(q.total_amount_cents), 0) as total_value_cents"
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as draft_quotations",
            ["draft"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as sent_quotations",
            ["sent"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as viewed_quotations",
            ["viewed"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as accepted_quotations",
            ["accepted"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as rejected_quotations",
            ["rejected"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as expired_quotations",
            ["expired"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as invoiced_quotations",
            ["invoiced"]
          ),
          fastify.knex.raw(
            "COALESCE(SUM(CASE WHEN q.status IN (?, ?) THEN q.total_amount_cents END), 0) as accepted_value_cents",
            ["accepted", "invoiced"]
          )
        )
        .leftJoin("companies as c", "q.company_id", "c.id")
        .groupBy("c.id", "c.name");

      // Aplicar filtros baseados no plano do usuário
      if (!isAdmin) {
        query = query.where("c.owner_id", userId);
      }

      // Filtros de data
      if (date_from) {
        query = query.where("q.issue_date", ">=", date_from);
      }

      if (date_to) {
        query = query.where("q.issue_date", "<=", date_to);
      }

      const stats = await query.orderBy("total_quotations", "desc");

      return stats.map((stat) => ({
        company_id: stat.company_id,
        company_name: stat.company_name,
        total_quotations: parseInt(stat.total_quotations || 0),
        draft_quotations: parseInt(stat.draft_quotations || 0),
        sent_quotations: parseInt(stat.sent_quotations || 0),
        viewed_quotations: parseInt(stat.viewed_quotations || 0),
        accepted_quotations: parseInt(stat.accepted_quotations || 0),
        rejected_quotations: parseInt(stat.rejected_quotations || 0),
        expired_quotations: parseInt(stat.expired_quotations || 0),
        invoiced_quotations: parseInt(stat.invoiced_quotations || 0),
        total_value: parseFloat((stat.total_value_cents || 0) / 100),
        accepted_value: parseFloat((stat.accepted_value_cents || 0) / 100),
      }));
    } catch (error) {
      fastify.log.error(
        error,
        "[DashboardService.getCompanyStats] Erro ao buscar estatísticas por empresa"
      );
      throw fastify.httpErrors.internalServerError(
        "Erro ao buscar estatísticas por empresa"
      );
    }
  }

  /**
   * Evolução dos orçamentos por status ao longo do tempo
   */
  static async getTimeline(fastify, user, filters = {}) {
    try {
      const { userPlan, userId, isAdmin } = this._validateUser(fastify, user);
      const { period = "month", months = 12 } = filters;

      let dateFormat, intervalString;

      switch (period) {
        case "week":
          dateFormat = 'YYYY-"W"WW';
          intervalString = `${months * 4} weeks`;
          break;
        case "quarter":
          dateFormat = 'YYYY-"Q"Q';
          intervalString = `${months} months`;
          break;
        default:
          dateFormat = "YYYY-MM";
          intervalString = `${months} months`;
      }

      let query = fastify
        .knex("quotes as q")
        .select(
          fastify.knex.raw(`TO_CHAR(q.issue_date, '${dateFormat}') as period`),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as draft",
            ["draft"]
          ),
          fastify.knex.raw("COUNT(CASE WHEN q.status = ? THEN 1 END) as sent", [
            "sent",
          ]),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as viewed",
            ["viewed"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as accepted",
            ["accepted"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as rejected",
            ["rejected"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as expired",
            ["expired"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as invoiced",
            ["invoiced"]
          ),
          fastify.knex.raw(
            "COALESCE(SUM(q.total_amount_cents), 0) as total_value_cents"
          )
        )
        .leftJoin("companies as c", "q.company_id", "c.id")
        .where(
          "q.issue_date",
          ">=",
          fastify.knex.raw(`NOW() - INTERVAL '${intervalString}'`)
        )
        .groupByRaw(`TO_CHAR(q.issue_date, '${dateFormat}')`)
        .orderByRaw(`TO_CHAR(q.issue_date, '${dateFormat}') DESC`);

      // Aplicar filtros baseados no plano do usuário
      if (!isAdmin) {
        query = query.where("c.owner_id", userId);
      }

      const timeline = await query;

      return timeline.map((item) => ({
        period: item.period,
        draft: parseInt(item.draft || 0),
        sent: parseInt(item.sent || 0),
        viewed: parseInt(item.viewed || 0),
        accepted: parseInt(item.accepted || 0),
        rejected: parseInt(item.rejected || 0),
        expired: parseInt(item.expired || 0),
        invoiced: parseInt(item.invoiced || 0),
        total_value: parseFloat((item.total_value_cents || 0) / 100),
      }));
    } catch (error) {
      fastify.log.error(
        error,
        "[DashboardService.getTimeline] Erro ao buscar timeline"
      );
      throw fastify.httpErrors.internalServerError(
        "Erro ao buscar timeline de estatísticas"
      );
    }
  }

  /**
   * Top clientes por valor de orçamentos
   */
  static async getTopClients(fastify, user, filters = {}) {
    try {
      const { userPlan, userId, isAdmin } = this._validateUser(fastify, user);
      const { limit = 10, date_from, date_to } = filters;

      let query = fastify
        .knex("quotes as q")
        .select(
          "cl.id as client_id",
          "cl.name as client_name",
          "cl.email as client_email",
          fastify.knex.raw("COUNT(*) as total_quotations"),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status IN (?, ?) THEN 1 END) as accepted_quotations",
            ["accepted", "invoiced"]
          ),
          fastify.knex.raw(
            "COALESCE(SUM(q.total_amount_cents), 0) as total_value_cents"
          ),
          fastify.knex.raw(
            "COALESCE(SUM(CASE WHEN q.status IN (?, ?) THEN q.total_amount_cents END), 0) as accepted_value_cents",
            ["accepted", "invoiced"]
          ),
          fastify.knex.raw(
            "ROUND(COUNT(CASE WHEN q.status IN (?, ?) THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) as acceptance_rate",
            ["accepted", "invoiced"]
          )
        )
        .leftJoin("companies as c", "q.company_id", "c.id")
        .leftJoin("clients as cl", "q.client_id", "cl.id")
        .whereNotNull("cl.id")
        .groupBy("cl.id", "cl.name", "cl.email");

      // Aplicar filtros baseados no plano do usuário
      if (!isAdmin) {
        query = query.where("c.owner_id", userId);
      }

      // Filtros de data
      if (date_from) {
        query = query.where("q.issue_date", ">=", date_from);
      }

      if (date_to) {
        query = query.where("q.issue_date", "<=", date_to);
      }

      const topClients = await query
        .orderBy("accepted_value_cents", "desc")
        .limit(limit);

      return topClients.map((client) => ({
        client_id: client.client_id,
        client_name: client.client_name,
        client_email: client.client_email,
        total_quotations: parseInt(client.total_quotations || 0),
        accepted_quotations: parseInt(client.accepted_quotations || 0),
        total_value: parseFloat((client.total_value_cents || 0) / 100),
        accepted_value: parseFloat((client.accepted_value_cents || 0) / 100),
        acceptance_rate: parseFloat(client.acceptance_rate || 0),
      }));
    } catch (error) {
      fastify.log.error(
        error,
        "[DashboardService.getTopClients] Erro ao buscar top clientes"
      );
      throw fastify.httpErrors.internalServerError(
        "Erro ao buscar top clientes"
      );
    }
  }

  /**
   * Estatísticas de conversão
   */
  static async getConversionStats(fastify, user, filters = {}) {
    try {
      const { userPlan, userId, isAdmin } = this._validateUser(fastify, user);
      const { date_from, date_to } = filters;

      let query = fastify
        .knex("quotes as q")
        .select(
          fastify.knex.raw("COUNT(*) as total_quotes"),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as sent_quotes",
            ["sent"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status IN (?, ?, ?) THEN 1 END) as viewed_quotes",
            ["viewed", "accepted", "rejected"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as accepted_quotes",
            ["accepted"]
          ),
          fastify.knex.raw(
            "COUNT(CASE WHEN q.status = ? THEN 1 END) as invoiced_quotes",
            ["invoiced"]
          ),
          fastify.knex.raw(
            "ROUND(COUNT(CASE WHEN q.status IN (?, ?, ?) THEN 1 END)::numeric / NULLIF(COUNT(CASE WHEN q.status = ? THEN 1 END)::numeric, 0) * 100, 2) as view_rate",
            ["viewed", "accepted", "rejected", "sent"]
          ),
          fastify.knex.raw(
            "ROUND(COUNT(CASE WHEN q.status = ? THEN 1 END)::numeric / NULLIF(COUNT(CASE WHEN q.status IN (?, ?, ?) THEN 1 END)::numeric, 0) * 100, 2) as acceptance_rate",
            ["accepted", "viewed", "accepted", "rejected"]
          ),
          fastify.knex.raw(
            "ROUND(COUNT(CASE WHEN q.status = ? THEN 1 END)::numeric / NULLIF(COUNT(CASE WHEN q.status = ? THEN 1 END)::numeric, 0) * 100, 2) as invoice_rate",
            ["invoiced", "accepted"]
          )
        )
        .leftJoin("companies as c", "q.company_id", "c.id");

      // Aplicar filtros baseados no plano do usuário
      if (!isAdmin) {
        query = query.where("c.owner_id", userId);
      }

      // Filtros de data
      if (date_from) {
        query = query.where("q.issue_date", ">=", date_from);
      }

      if (date_to) {
        query = query.where("q.issue_date", "<=", date_to);
      }

      const stats = await query.first();

      return {
        total_quotes: parseInt(stats.total_quotes || 0),
        sent_quotes: parseInt(stats.sent_quotes || 0),
        viewed_quotes: parseInt(stats.viewed_quotes || 0),
        accepted_quotes: parseInt(stats.accepted_quotes || 0),
        invoiced_quotes: parseInt(stats.invoiced_quotes || 0),
        view_rate: parseFloat(stats.view_rate || 0),
        acceptance_rate: parseFloat(stats.acceptance_rate || 0),
        invoice_rate: parseFloat(stats.invoice_rate || 0),
      };
    } catch (error) {
      fastify.log.error(
        error,
        "[DashboardService.getConversionStats] Erro ao buscar estatísticas de conversão"
      );
      throw fastify.httpErrors.internalServerError(
        "Erro ao buscar estatísticas de conversão"
      );
    }
  }

  /**
   * Orçamentos próximos do vencimento
   */
  static async getExpiringQuotes(fastify, user, filters = {}) {
    try {
      const { userPlan, userId, isAdmin } = this._validateUser(fastify, user);
      const { days = 7, limit = 10 } = filters;

      let query = fastify
        .knex("quotes as q")
        .select(
          "q.public_id as id",
          "q.quote_number",
          "q.status",
          "q.expiry_date",
          "q.total_amount_cents",
          "c.name as company_name",
          "cl.name as client_name",
          "cl.email as client_email"
        )
        .leftJoin("companies as c", "q.company_id", "c.id")
        .leftJoin("clients as cl", "q.client_id", "cl.id")
        .whereNotNull("q.expiry_date")
        .whereIn("q.status", ["sent", "viewed"])
        .where("q.expiry_date", ">=", fastify.knex.raw("CURRENT_DATE"))
        .where(
          "q.expiry_date",
          "<=",
          fastify.knex.raw(`CURRENT_DATE + INTERVAL '${days} days'`)
        );

      // Aplicar filtros baseados no plano do usuário
      if (!isAdmin) {
        query = query.where("c.owner_id", userId);
      }

      const expiringQuotes = await query
        .orderBy("q.expiry_date", "asc")
        .limit(limit);

      return expiringQuotes.map((quote) => ({
        id: quote.id,
        quote_number: quote.quote_number,
        status: quote.status,
        expiry_date: quote.expiry_date,
        total_amount_cents: parseInt(quote.total_amount_cents || 0),
        company_name: quote.company_name,
        client: {
          name: quote.client_name,
          email: quote.client_email,
        },
      }));
    } catch (error) {
      fastify.log.error(
        error,
        "[DashboardService.getExpiringQuotes] Erro ao buscar orçamentos próximos do vencimento"
      );
      throw fastify.httpErrors.internalServerError(
        "Erro ao buscar orçamentos próximos do vencimento"
      );
    }
  }

  /**
   * Resumo de atividades recentes
   */
  static async getRecentActivity(fastify, user, filters = {}) {
    try {
      const { userPlan, userId, isAdmin } = this._validateUser(fastify, user);
      const { limit = 20 } = filters;

      let query = fastify
        .knex("quotes as q")
        .select(
          "q.public_id as id",
          "q.quote_number",
          "q.status",
          "q.total_amount_cents",
          "q.created_at",
          "q.updated_at",
          "c.name as company_name",
          "cl.name as client_name",
          fastify.knex.raw(
            "CASE WHEN q.created_at > q.updated_at THEN 'created' ELSE 'updated' END as activity_type"
          )
        )
        .leftJoin("companies as c", "q.company_id", "c.id")
        .leftJoin("clients as cl", "q.client_id", "cl.id")
        .where(
          "q.updated_at",
          ">=",
          fastify.knex.raw("NOW() - INTERVAL '30 days'")
        );

      // Aplicar filtros baseados no plano do usuário
      if (!isAdmin) {
        query = query.where("c.owner_id", userId);
      }

      const recentActivity = await query
        .orderBy("q.updated_at", "desc")
        .limit(limit);

      return recentActivity.map((activity) => ({
        id: activity.id,
        quote_number: activity.quote_number,
        status: activity.status,
        total_amount_cents: parseInt(activity.total_amount_cents || 0),
        activity_type: activity.activity_type,
        created_at: activity.created_at,
        updated_at: activity.updated_at,
        company_name: activity.company_name,
        client_name: activity.client_name,
      }));
    } catch (error) {
      fastify.log.error(
        error,
        "[DashboardService.getRecentActivity] Erro ao buscar atividades recentes"
      );
      throw fastify.httpErrors.internalServerError(
        "Erro ao buscar atividades recentes"
      );
    }
  }

  /**
   * Alertas e notificações do dashboard
   */
  static async getDashboardAlerts(fastify, user) {
    try {
      const { userPlan, userId, isAdmin } = this._validateUser(fastify, user);
      const alerts = [];

      // Query base para aplicar filtros de permissão
      let baseQuery = fastify
        .knex("quotes as q")
        .leftJoin("companies as c", "q.company_id", "c.id");

      if (!isAdmin) {
        baseQuery = baseQuery.where("c.owner_id", userId);
      }

      // 1. Orçamentos vencendo em 3 dias
      const expiringQuotes = await baseQuery
        .clone()
        .select("q.id", "q.quote_number", "q.expiry_date")
        .whereNotNull("q.expiry_date")
        .whereIn("q.status", ["sent", "viewed"])
        .where("q.expiry_date", ">=", fastify.knex.raw("CURRENT_DATE"))
        .where(
          "q.expiry_date",
          "<=",
          fastify.knex.raw("CURRENT_DATE + INTERVAL '3 days'")
        )
        .orderBy("q.expiry_date", "asc");

      if (expiringQuotes.length > 0) {
        alerts.push({
          type: "warning",
          title: "Orçamentos vencendo",
          message: `${expiringQuotes.length} orçamento(s) vencem nos próximos 3 dias`,
          count: expiringQuotes.length,
          action_url: "/dashboard/expiring-quotes",
          priority: "high",
        });
      }

      // 2. Orçamentos pendentes de resposta há mais de 7 dias
      const stalledQuotes = await baseQuery
        .clone()
        .select("q.id")
        .whereIn("q.status", ["sent", "viewed"])
        .where(
          "q.updated_at",
          "<=",
          fastify.knex.raw("NOW() - INTERVAL '7 days'")
        );

      if (stalledQuotes.length > 0) {
        alerts.push({
          type: "info",
          title: "Orçamentos sem resposta",
          message: `${stalledQuotes.length} orçamento(s) sem resposta há mais de 7 dias`,
          count: stalledQuotes.length,
          action_url: "/dashboard/quotations?status=sent,viewed",
          priority: "medium",
        });
      }

      // 3. Verificar limites do plano se houver informações de plano
      if (userPlan && userPlan.features) {
        const features = userPlan.features;

        // Verificar limite mensal de orçamentos
        if (features.max_quotes_per_month) {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();

          const monthlyQuotes = await baseQuery
            .clone()
            .count("* as total")
            .whereRaw("EXTRACT(MONTH FROM q.created_at) = ?", [currentMonth])
            .whereRaw("EXTRACT(YEAR FROM q.created_at) = ?", [currentYear])
            .first();

          const quotesUsed = parseInt(monthlyQuotes.total);
          const quotesLimit = features.max_quotes_per_month;
          const usagePercentage = (quotesUsed / quotesLimit) * 100;

          if (usagePercentage >= 90) {
            alerts.push({
              type: usagePercentage >= 100 ? "error" : "warning",
              title: "Limite de orçamentos",
              message: `${quotesUsed}/${quotesLimit} orçamentos utilizados este mês (${usagePercentage.toFixed(
                1
              )}%)`,
              count: quotesUsed,
              action_url: "/plans",
              priority: usagePercentage >= 100 ? "high" : "medium",
            });
          }
        }
      }

      return alerts.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    } catch (error) {
      fastify.log.error(
        error,
        "[DashboardService.getDashboardAlerts] Erro ao buscar alertas"
      );
      throw fastify.httpErrors.internalServerError(
        "Erro ao buscar alertas do dashboard"
      );
    }
  }
}

module.exports = DashboardService;
