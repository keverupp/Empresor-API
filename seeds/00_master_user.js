// seeds/00_master_user.js
require('dotenv').config();
const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deleta dados existentes para evitar duplicatas
  await knex('users').where({ email: process.env.MASTER_USER_EMAIL || 'master@system.com' }).del();
  await knex('plans').where({ name: 'super_admin' }).del();

  // 1. Cria o plano "super_admin"
  const [plan] = await knex('plans').insert({
    name: 'super_admin',
    price_cents: 0,
    features: JSON.stringify({
      users: 999,
      products: 999,
      customers: 999,
      quotes: 999,
      schedules: 999,
      reports: true,
      image_upload: true,
      custom_logo: true,
    }),
  }).returning('*');

  // 2. Cria o usuário "master" (sem senha, pois não é necessária para a master key)
  const [masterUser] = await knex('users').insert({
    name: 'Master User',
    email: process.env.MASTER_USER_EMAIL || 'master@system.com',
    password_hash: await bcrypt.hash('master_password', 10), // A coluna não pode ser nula
    role: 'admin',
    status: 'active'
  }).returning('*');

  // 3. Cria a assinatura do plano para o usuário master
  await knex('user_plan_subscriptions').insert({
    user_id: masterUser.id,
    plan_id: plan.id,
    status: 'active',
  });
};
