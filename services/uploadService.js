"use strict";

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require("crypto");

const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

class UploadService {
  async createPresignedUrl(fastify, { fileName, fileType }) {
    const { log } = fastify;

    try {
      const uniqueFileName = `${crypto.randomBytes(16).toString("hex")}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.MINIO_BUCKET_NAME,
        Key: uniqueFileName,
        ContentType: fileType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      const fileUrl = `${process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET_NAME}/${uniqueFileName}`;

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
