"use strict";

const envSchema = {
  type: "object",

  // Variáveis obrigatórias — o app não sobe sem elas
  required: [
    "DATABASE_URL",
    "JWT_SECRET",
    "FRONTEND_URL",

    // Email
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_SECURE",
    "EMAIL_USER",
    "EMAIL_PASS",
    "EMAIL_FROM",

    // Cloudinary
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",

    // Google OAuth
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_BACKEND_REDIRECT_URI",
  ],

  properties: {
    /* ---------------------- CONFIGURAÇÕES GERAIS ---------------------- */
    NODE_ENV: { type: "string", default: "development" },
    HOST: { type: "string", default: "0.0.0.0" },
    PORT: { type: "integer", default: 3000 },
    APP_NAME: { type: "string", default: "Fastify API" },
    APP_DESCRIPTION: { type: "string" },
    APP_VERSION: { type: "string", default: "1.0.0" },
    FRONTEND_URL: { type: "string" },

    /* ---------------------- BANCO DE DADOS ---------------------- */
    DATABASE_URL: { type: "string" },

    /* ---------------------- AUTENTICAÇÃO ---------------------- */
    JWT_SECRET: { type: "string" },
    MASTER_KEY: { type: "string" },
    MASTER_USER_EMAIL: { type: "string", default: "master@system.com" },
    JWT_EXPIRES_IN: { type: "string", default: "7d" },

    /* ---------------------- EMAIL ---------------------- */
    EMAIL_HOST: { type: "string" },
    EMAIL_PORT: { type: "integer" },
    EMAIL_SECURE: { type: "boolean" },
    EMAIL_USER: { type: "string" },
    EMAIL_PASS: { type: "string" },
    EMAIL_FROM: { type: "string" },

    /* ---------------------- CLOUDINARY ---------------------- */
    CLOUDINARY_CLOUD_NAME: { type: "string" },
    CLOUDINARY_API_KEY: { type: "string" },
    CLOUDINARY_API_SECRET: { type: "string" },

    /* ---------------------- GOOGLE OAUTH ---------------------- */
    GOOGLE_CLIENT_ID: { type: "string" },
    GOOGLE_CLIENT_SECRET: { type: "string" },
    GOOGLE_BACKEND_REDIRECT_URI: { type: "string" },

    /* ---------------------- MINIO / STORAGE ---------------------- */
    MINIO_ENDPOINT: { type: "string" },
    MINIO_BUCKET_NAME: { type: "string" },
    MINIO_ACCESS_KEY: { type: "string" },
    MINIO_SECRET_KEY: { type: "string" },

    /* ---------------------- CORS ---------------------- */
    CORS_ORIGIN: { type: "string", default: "*" },
    CORS_CREDENTIALS: { type: "boolean", default: false },

    /* ---------------------- LIMITES / UPLOAD ---------------------- */
    RATE_LIMIT_MAX: { type: "integer", default: 100 },
    RATE_LIMIT_WINDOW: { type: "integer", default: 900000 },
    MAX_FILE_SIZE: { type: "integer", default: 10485760 }, // 10 MB
    UPLOAD_LIMIT: { type: "integer", default: 5 },

    /* ---------------------- SWAGGER ---------------------- */
    SWAGGER_HOST: { type: "string" },
    SWAGGER_SCHEMES: { type: "string", default: "http" },
  },
};

module.exports = envSchema;
