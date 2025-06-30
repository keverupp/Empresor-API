const build = require('./build');
let fastify;
let data = {};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'pgmem';
  process.env.JWT_SECRET = 'secret';
  process.env.FRONTEND_URL = 'http://localhost';
  process.env.EMAIL_HOST = 'smtp';
  process.env.EMAIL_PORT = '25';
  process.env.EMAIL_SECURE = 'false';
  process.env.EMAIL_USER = 'user';
  process.env.EMAIL_PASS = 'pass';
  process.env.EMAIL_FROM = 'test@example.com';
  process.env.CLOUDINARY_CLOUD_NAME = 'cloud';
  process.env.CLOUDINARY_API_KEY = 'key';
  process.env.CLOUDINARY_API_SECRET = 'secret';
  process.env.GOOGLE_CLIENT_ID = 'id';
  process.env.GOOGLE_CLIENT_SECRET = 'secret';
  process.env.GOOGLE_BACKEND_REDIRECT_URI = 'http://localhost/google';

  fastify = await build();

  const passwordHash = await fastify.bcrypt.hash('pass');
  const [user] = await fastify.knex('users')
    .insert({ name: 'Tester', email: 'tester@example.com', password_hash: passwordHash })
    .returning(['id', 'public_id', 'email', 'name']);

  const plan = await fastify.knex('plans').where({ name: 'Profissional' }).first();
  await fastify.knex('user_plan_subscriptions').insert({ user_id: user.id, plan_id: plan.id, status: 'active' });

  const [company] = await fastify.knex('companies')
    .insert({ owner_id: user.id, name: 'MyCo' })
    .returning(['id', 'public_id', 'owner_id']);

  const [client] = await fastify.knex('clients')
    .insert({ company_id: company.id, name: 'Client 1' })
    .returning(['id', 'public_id']);

  const [product] = await fastify.knex('products')
    .insert({ company_id: company.id, name: 'Prod1' })
    .returning(['id', 'public_id']);

  const [quote] = await fastify.knex('quotes')
    .insert({
      company_id: company.id,
      client_id: client.id,
      created_by_user_id: user.id,
      quote_number: 'Q1',
      subtotal_cents: 100,
      total_amount_cents: 100,
      currency: 'BRL'
    })
    .returning(['id', 'public_id', 'client_id', 'created_by_user_id']);

  const token = fastify.jwt.sign({ userId: user.id, role: 'user', email: user.email });
  data = { user, company, client, product, quote, token };
});

afterAll(async () => {
  await fastify.close();
});

test('GET client by id', async () => {
  const res = await fastify.inject({
    method: 'GET',
    url: `/api/companies/${data.company.public_id}/clients/${data.client.public_id}`,
    headers: { authorization: `Bearer ${data.token}` }
  });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.payload);
  expect(typeof body.company_id).toBe('string');
  expect(body.company_id).toBe(data.company.public_id);
});

test('GET products', async () => {
  const res = await fastify.inject({
    method: 'GET',
    url: `/api/companies/${data.company.public_id}/products`,
    headers: { authorization: `Bearer ${data.token}` }
  });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.payload);
  expect(body.data.length).toBeGreaterThan(0);
  expect(body.data[0].company_id).toBe(data.company.public_id);
  expect(typeof body.data[0].company_id).toBe('string');
});

test('GET quotes', async () => {
  const res = await fastify.inject({
    method: 'GET',
    url: `/api/companies/${data.company.public_id}/quotes`,
    headers: { authorization: `Bearer ${data.token}` }
  });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.payload);
  expect(body.data.length).toBeGreaterThan(0);
  const q = body.data[0];
  expect(typeof q.company_id).toBe('string');
  expect(q.company_id).toBe(data.company.public_id);
  expect(typeof q.client_id).toBe('string');
  expect(q.client_id).toBe(data.client.public_id);
  expect(typeof q.created_by_user_id).toBe('number');
  expect(q.created_by_user_id).toBe(data.user.id);
});
