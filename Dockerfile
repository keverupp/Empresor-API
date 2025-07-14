# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    postgresql-client

# Tell Puppeteer to skip installing Chromium. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create entrypoint script inline
RUN echo '#!/bin/sh\n\
    set -e\n\
    echo "Starting Fastify API..."\n\
    echo "Waiting for database to be ready..."\n\
    until pg_isready -h $(echo $DATABASE_URL | sed "s/.*@\\([^:]*\\):.*/\\1/") -p $(echo $DATABASE_URL | sed "s/.*:\\([0-9]*\\)\\/.*/\\1/") 2>/dev/null; do\n\
    echo "Database is unavailable - sleeping"\n\
    sleep 2\n\
    done\n\
    echo "Database is ready!"\n\
    echo "Running database migrations..."\n\
    npm run migrate 2>/dev/null || npx knex migrate:latest 2>/dev/null || echo "Migration failed or no migrations to run"\n\
    if [ "$NODE_ENV" != "production" ] || [ "$FORCE_SEEDS" = "true" ]; then\n\
    echo "Running database seeds..."\n\
    npm run seed 2>/dev/null || npx knex seed:run 2>/dev/null || echo "Seeds failed or no seeds to run"\n\
    else\n\
    echo "Skipping seeds in production environment"\n\
    fi\n\
    echo "Starting application..."\n\
    exec "$@"' > /usr/local/bin/docker-entrypoint.sh

# Make script executable
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S fastify -u 1001

# Change ownership of the app directory
RUN chown -R fastify:nodejs /app
USER fastify

# Expose port
EXPOSE 3001

# Start the application
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]