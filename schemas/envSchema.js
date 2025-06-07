"use strict";

const envSchema = {
  type: "object",

  // Lista de variáveis obrigatórias. A aplicação não iniciará se alguma delas faltar.
  required: [
    "DATABASE_URL",
    "JWT_SECRET",
    "FRONTEND_URL",

    // Variáveis de Email
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_SECURE",
    "EMAIL_USER",
    "EMAIL_PASS",
    "EMAIL_FROM",

    // Variáveis do Cloudinary
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",

    // Variáveis do Google OAuth
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_BACKEND_REDIRECT_URI",
  ],

  // Definição e tipagem de cada variável de ambiente
  properties: {
    // Configurações Gerais
    NODE_ENV: { type: "string", default: "development" },
    PORT: { type: "integer", default: 3000 },
    HOST: { type: "string", default: "127.0.0.1" },

    // Banco de Dados
    DATABASE_URL: { type: "string" },

    // Autenticação e Tokens
    JWT_SECRET: { type: "string" },
    ACCESS_TOKEN_EXPIRES_IN: { type: "string", default: "1h" },
    REFRESH_TOKEN_EXPIRES_IN: { type: "string", default: "7d" },
    PASSWORD_RESET_TOKEN_EXPIRES_IN_MS: { type: "integer", default: 3600000 }, // 1 hora

    // Configurações de Email
    EMAIL_HOST: { type: "string" },
    EMAIL_PORT: { type: "integer" },
    EMAIL_SECURE: { type: "boolean" },
    EMAIL_USER: { type: "string" },
    EMAIL_PASS: { type: "string" },
    EMAIL_FROM: { type: "string" },
    FRONTEND_URL: { type: "string" },

    // Variáveis de personalização de email (opcionais, com fallback no código)
    EMAIL_FROM_NAME: { type: "string", default: "Empresor" },
    COMPANY_LOGO_URL: { type: "string" },
    EMAIL_PRIMARY_COLOR: { type: "string", default: "#F97316" },

    // Google OAuth
    GOOGLE_CLIENT_ID: { type: "string" },
    GOOGLE_CLIENT_SECRET: { type: "string" },
    GOOGLE_BACKEND_REDIRECT_URI: { type: "string" },

    // Configurações do Cloudinary
    CLOUDINARY_CLOUD_NAME: { type: "string" },
    CLOUDINARY_API_KEY: { type: "string" },
    CLOUDINARY_API_SECRET: { type: "string" },
  },
};

module.exports = envSchema;
