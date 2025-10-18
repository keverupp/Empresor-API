// seeds/00_master_user.js
require('dotenv').config();
const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deleta dados existentes para evitar duplicatas
  await knex('users').where({ email: process.env.MASTER_USER_EMAIL || 'master@system.com' }).del();
  await knex('plans').where({ name: 'super_admin' }).del();

  // Cria o plano "super_admin"
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

  // Cria o usuário "master"
  const hashedPassword = await bcrypt.hash('master_password', 10);
  await knex('users').insert({
    name: 'Master User',
    email: process.env.MASTER_USER_EMAIL || 'master@system.com',
    password: hashedPassword,
    plan_id: plan.id,
  });
};
