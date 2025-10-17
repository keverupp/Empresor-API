# Usar Node.js LTS (18) leve com Alpine
FROM node:18-alpine

# Diretório de trabalho
WORKDIR /app

# Define ambiente de produção por padrão
ENV NODE_ENV=production

# Copia manifestos e instala dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia o código da aplicação
COPY . .

# Cria usuário não-root por segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S fastify -u 1001 && \
    chown -R fastify:nodejs /app
USER fastify

# Porta interna (o proxy acessará via rede Docker)
EXPOSE 3001

# Comando inicial da API
CMD ["node", "app.js"]
