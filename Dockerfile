# Use Node.js LTS (18) com Alpine
FROM node:18-alpine

# Diretório de trabalho
WORKDIR /app

# Dependências do Puppeteer/Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Puppeteer usará o Chromium do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Copia manifestos e instala dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia o código da aplicação
COPY . .

# Usuário não-root por segurança
RUN addgroup -g 1001 -S nodejs && adduser -S fastify -u 1001 && \
    chown -R fastify:nodejs /app
USER fastify

# Porta interna (não será publicada no host; o proxy acessa via rede)
EXPOSE 3001

# Inicia a API (ajuste se seu entrypoint for outro arquivo)
CMD ["node", "app.js"]
