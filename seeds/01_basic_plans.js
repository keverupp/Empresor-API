// seeds/01_basic_plans.js

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function (knex) {
  // Deleta todos os registros existentes na tabela 'plans' ANTES de inserir novos.
  // Isso garante que, se você rodar o seed múltiplas vezes, não terá dados duplicados
  // e sempre começará com este conjunto definido.
  // CUIDADO: Isso apaga todos os planos. Se você tiver planos personalizados que quer manter,
  // pode precisar de uma lógica mais sofisticada aqui (ex: deletar apenas os planos com IDs/nomes específicos).
  await knex("plans").del();

  // Insere os planos básicos
  await knex("plans").insert([
    {
      // id será autoincrementado
      name: "Gratuito",
      description:
        "Funcionalidades essenciais para começar a gerenciar seus orçamentos.",
      price_cents: 0,
      price_currency: "BRL",
      billing_cycle: null, // Ou 'lifetime' se preferir um marcador
      features: JSON.stringify({
        max_companies_owned: 1,
        max_quotes_per_month: 10,
        max_items_per_quote: 5,
        allow_product_catalog: false,
        allow_pdf_customization: false,
        max_companies_shared_limit: 0, // Não pode compartilhar empresas que possui
        max_companies_received_limit: 1, // Pode participar de 1 empresa compartilhada
        allow_company_sharing: false,
        // Adicione outras flags/limites conforme necessário para o plano gratuito
      }),
      is_active: true,
      // created_at e updated_at usarão os defaults do banco de dados (NOW())
    },
    {
      name: "Profissional",
      description:
        "Recursos avançados para empresas e freelancers em crescimento.",
      price_cents: 2990, // Exemplo: R$29,90
      price_currency: "BRL",
      billing_cycle: "monthly",
      features: JSON.stringify({
        max_companies_owned: 3,
        max_quotes_per_month: 100,
        max_items_per_quote: 25,
        allow_product_catalog: true,
        allow_pdf_customization: true,
        max_companies_shared_limit: 2, // Pode compartilhar até 2 empresas que possui
        max_companies_received_limit: 5, // Pode participar de até 5 empresas compartilhadas
        allow_company_sharing: true,
        // Adicione outras flags/limites
      }),
      is_active: true,
    },
    {
      name: "Premium",
      description:
        "Todas as funcionalidades e limites expandidos para usuários com alto volume.",
      price_cents: 7990, // Exemplo: R$79,90
      price_currency: "BRL",
      billing_cycle: "monthly",
      features: JSON.stringify({
        max_companies_owned: 10,
        max_quotes_per_month: 1000, // Ou use -1 para representar "ilimitado" na sua lógica
        max_items_per_quote: 50, // Ou use -1 para "ilimitado"
        allow_product_catalog: true,
        allow_pdf_customization: true,
        max_companies_shared_limit: 10,
        max_companies_received_limit: 10,
        allow_company_sharing: true,
        priority_support: true,
        // Adicione outras flags/limites
      }),
      is_active: true,
    },
  ]);

  // Knex lida bem com objetos JS para colunas JSON/JSONB no PostgreSQL,
  // então JSON.stringify() pode não ser estritamente necessário para `features` dependendo da sua versão do Knex/driver.
  // No entanto, usá-lo garante que será uma string JSON válida.
  // Se preferir, pode passar o objeto diretamente:
  // features: { /* ... objeto ... */ },
};
