// seeds/01_basic_plans.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  // Deleta todos os registros existentes na tabela 'plans' ANTES de inserir novos.
  await knex("plans").del();

  // Insere os planos básicos com as novas features para produtos
  await knex("plans").insert([
    {
      name: "Gratuito",
      description:
        "Funcionalidades essenciais para começar a gerenciar seus orçamentos.",
      price_cents: 0,
      price_currency: "BRL",
      billing_cycle: null,
      features: JSON.stringify({
        max_companies_owned: 1,
        max_quotes_per_month: 10,
        max_items_per_quote: 5,
        allow_product_catalog: false, // SEM catálogo de produtos
        max_products_per_company: 0, // Zero produtos permitidos
        allow_pdf_customization: false,
        max_companies_shared_limit: 0,
        max_companies_received_limit: 1,
        allow_company_sharing: false,
      }),
      is_active: true,
    },
    {
      name: "Profissional",
      description:
        "Recursos avançados para empresas e freelancers em crescimento.",
      price_cents: 2990, // R$29,90
      price_currency: "BRL",
      billing_cycle: "monthly",
      features: JSON.stringify({
        max_companies_owned: 3,
        max_quotes_per_month: 100,
        max_items_per_quote: 25,
        allow_product_catalog: true, // COM catálogo de produtos
        max_products_per_company: 50, // Até 50 produtos por empresa
        allow_pdf_customization: true,
        max_companies_shared_limit: 2,
        max_companies_received_limit: 5,
        allow_company_sharing: true,
      }),
      is_active: true,
    },
    {
      name: "Premium",
      description:
        "Todas as funcionalidades e limites expandidos para usuários com alto volume.",
      price_cents: 7990, // R$79,90
      price_currency: "BRL",
      billing_cycle: "monthly",
      features: JSON.stringify({
        max_companies_owned: 10,
        max_quotes_per_month: 1000,
        max_items_per_quote: 50,
        allow_product_catalog: true, // COM catálogo de produtos
        max_products_per_company: 500, // Até 500 produtos por empresa
        allow_pdf_customization: true,
        max_companies_shared_limit: 10,
        max_companies_received_limit: 10,
        allow_company_sharing: true,
        priority_support: true,
      }),
      is_active: true,
    },
  ]);
};
