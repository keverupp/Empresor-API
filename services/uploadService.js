"use strict";

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

let cachedS3Client = null;
let cachedClientSignature = null;

function getConfigValue(fastify, key) {
  return fastify?.config?.[key] ?? process.env[key];
}

function buildMinioConfig(fastify) {
  const endpoint = getConfigValue(fastify, "MINIO_ENDPOINT");
  const bucketName =
    getConfigValue(fastify, "MINIO_BUCKET_NAME") || getConfigValue(fastify, "MINIO_BUCKET");
  const accessKeyId = getConfigValue(fastify, "MINIO_ACCESS_KEY");
  const secretAccessKey = getConfigValue(fastify, "MINIO_SECRET_KEY");
  const region = getConfigValue(fastify, "MINIO_REGION") || "us-east-1";

  const missing = [];
  if (!endpoint) missing.push("MINIO_ENDPOINT");
  if (!bucketName) missing.push("MINIO_BUCKET_NAME (ou MINIO_BUCKET)");
  if (!accessKeyId) missing.push("MINIO_ACCESS_KEY");
  if (!secretAccessKey) missing.push("MINIO_SECRET_KEY");

  return {
    endpoint,
    bucketName,
    accessKeyId,
    secretAccessKey,
    region,
    missing,
  };
}

function getS3Client(config) {
  const signature = [config.endpoint, config.region, config.accessKeyId, config.secretAccessKey].join(
    "|",
  );

  if (!cachedS3Client || cachedClientSignature !== signature) {
    cachedS3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });

    cachedClientSignature = signature;
  }

  return cachedS3Client;
}

class UploadService {
  async createPresignedUrl(fastify, { fileName, fileType }) {
    const { log } = fastify;

    try {
      const minioConfig = buildMinioConfig(fastify);

      if (minioConfig.missing.length > 0) {
        const configError = fastify.httpErrors.internalServerError(
          `Configuração do MinIO incompleta. Variáveis ausentes: ${minioConfig.missing.join(", ")}`,
        );

        log.error({ msg: "Configuração do MinIO ausente", missing: minioConfig.missing });
        throw configError;
      }

      const s3Client = getS3Client(minioConfig);

      // Sanitize the filename to make it URL-friendly
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.\-]/g, "-");
      const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}-${sanitizedFileName}`;

      const command = new PutObjectCommand({
        Bucket: minioConfig.bucketName,
        Key: uniqueFileName,
        ContentType: fileType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      let fileUrl;

      try {
        const endpointUrl = new URL(minioConfig.endpoint);
        const basePath = endpointUrl.pathname.replace(/\/$/, "");
        endpointUrl.pathname = `${basePath}/${minioConfig.bucketName}/${uniqueFileName}`;
        fileUrl = endpointUrl.toString();
      } catch (urlError) {
        const normalizedEndpoint = minioConfig.endpoint.replace(/\/$/, "");
        fileUrl = `${normalizedEndpoint}/${minioConfig.bucketName}/${uniqueFileName}`;
        log.warn({ msg: "Endpoint MinIO inválido para URL. Utilizando fallback.", urlError });
      }

      log.info(`Presigned URL gerada para o arquivo: ${uniqueFileName}`);
      return { uploadUrl, fileUrl };
    } catch (error) {
      log.error({ msg: "Erro detalhado ao gerar presigned URL", error });
      const errorMessage = `Não foi possível gerar a URL de upload. Causa: ${error.message}`;
      const serviceError = new Error(errorMessage);
      serviceError.originalError = error;
      throw serviceError;
    }
  }
}

module.exports = new UploadService();
