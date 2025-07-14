#!/bin/sh
set -e

echo "Starting Fastify API..."

# Wait for database to be ready
echo "Waiting for database to be ready..."
until node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => {
    console.log('Database connected successfully');
    client.end();
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
" 2>/dev/null; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
npm run migrate || npx knex migrate:latest || echo "Migration failed or no migrations to run"

# Run seeds if not in production or if FORCE_SEEDS is set
if [ "$NODE_ENV" != "production" ] || [ "$FORCE_SEEDS" = "true" ]; then
  echo "Running database seeds..."
  npm run seed || npx knex seed:run || echo "Seeds failed or no seeds to run"
else
  echo "Skipping seeds in production environment"
fi

echo "Starting application..."
exec "$@"