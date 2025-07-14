#!/bin/sh
set -e

echo "Iniciando Fastify API..."
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "Working directory: $(pwd)"
echo "User: $(whoami)"

echo "Arquivos disponíveis:"
ls -la

echo "Verificando app.js:"
if [ -f "app.js" ]; then
    echo "✓ app.js encontrado"
    echo "Conteúdo das primeiras linhas:"
    head -5 app.js
else
    echo "✗ app.js NÃO encontrado!"
    echo "Arquivos .js disponíveis:"
    find . -name "*.js" -maxdepth 2
    exit 1
fi

echo "Testando Node.js:"
node --version
echo "Node.js OK"

echo "Testando sintaxe do app.js:"
node -c app.js
echo "Sintaxe OK"

echo "Verificando dependências básicas:"
ls -la node_modules/ | head -10

echo "=== Iniciando aplicação ==="
exec "$@"