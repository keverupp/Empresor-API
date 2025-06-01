"use strict";

const fp = require("fastify-plugin");
const nodemailer = require("nodemailer");

async function mailerPlugin(fastify, opts) {
  const { config, log } = fastify;

  // Verifica se as configurações essenciais de e-mail estão presentes
  if (
    !config.EMAIL_HOST ||
    !config.EMAIL_USER ||
    !config.EMAIL_PASS ||
    !config.EMAIL_PORT
  ) {
    log.warn(
      "[MailerPlugin] Configurações de SMTP (EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS) não estão completas. O serviço de e-mail não será inicializado."
    );
    // Não decora fastify.mailer, assim o AuthService pode detectar que não está configurado.
    return;
  }

  // Assegura que EMAIL_PORT seja um número e EMAIL_SECURE seja um booleano
  const emailPort = Number(config.EMAIL_PORT);
  const emailSecure =
    config.EMAIL_SECURE === true ||
    String(config.EMAIL_SECURE).toLowerCase() === "true";

  if (isNaN(emailPort)) {
    log.error(
      `[MailerPlugin] EMAIL_PORT inválido: "${config.EMAIL_PORT}". Deve ser um número.`
    );
    return;
  }

  const transporterOptions = {
    host: config.EMAIL_HOST,
    port: emailPort,
    secure: emailSecure, // true para 465 (SSL), false para outras portas (ex: 587 com STARTTLS)
    auth: {
      user: config.EMAIL_USER,
      pass: config.EMAIL_PASS,
    },
    // Adicione opções de depuração se necessário, especialmente em desenvolvimento
    // logger: config.NODE_ENV === 'development' ? log.child({module: 'nodemailer'}) : false,
    // debug: config.NODE_ENV === 'development',
  };

  try {
    const transporter = nodemailer.createTransport(transporterOptions);

    // Opcional: Verificar a conexão SMTP ao iniciar.
    // Isso pode adicionar um pequeno atraso na inicialização do servidor.
    // Remova ou comente se não desejar esta verificação no boot.
    // await transporter.verify();
    // log.info('[MailerPlugin] Conexão com o servidor SMTP verificada com sucesso.');

    fastify.decorate("mailer", transporter); // Decora com o objeto transporter do Nodemailer
    log.info(
      "[MailerPlugin] Nodemailer (fastify.mailer) configurado e pronto."
    );
  } catch (err) {
    log.error(
      err,
      "[MailerPlugin] Falha ao configurar o Nodemailer ou verificar a conexão SMTP."
    );
    // Dependendo da criticidade do e-mail para sua aplicação, você pode querer
    // lançar o erro aqui para impedir o boot do servidor.
    // throw new Error('Falha na configuração do serviço de e-mail.');
  }
}

module.exports = fp(mailerPlugin, {
  name: "mailer",
  dependencies: ["@fastify/env"], // Garante que fastify.config (com as vars do .env) esteja disponível
});
