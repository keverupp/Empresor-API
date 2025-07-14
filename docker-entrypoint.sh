#!/bin/sh
set -e

echo "Iniciando Fastify API..."
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"

# Executa o comando passado como parâmetro
exec "$@"