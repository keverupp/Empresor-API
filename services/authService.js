"use strict";

const {
  getPasswordResetEmailHTML,
} = require("../utils/emailResetPasswordTemplate.js");

/**
 * Helper interno para gerar tokens de acesso e atualização.
 * @param {import('fastify').FastifyInstance} fastify - Instância do Fastify.
 * @param {object} user - Objeto do usuário (deve conter 'id', 'role', 'email', e opcionalmente 'refresh_token').
 * @param {boolean} [rotateRefreshToken=true] - Se deve gerar e armazenar um novo refresh token.
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
async function _generateUserTokens(fastify, user, rotateRefreshToken = true) {
  const { jwt, knex, config } = fastify;

  const ACCESS_TOKEN_EXPIRES_IN = config.ACCESS_TOKEN_EXPIRES_IN;
  const REFRESH_TOKEN_EXPIRES_IN = config.REFRESH_TOKEN_EXPIRES_IN;

  const accessTokenPayload = {
    userId: user.id,
    role: user.role,
    email: user.email,
  };
  const accessToken = jwt.sign(accessTokenPayload, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

  let refreshTokenToStoreAndReturn = user.refresh_token;

  if (rotateRefreshToken || !user.refresh_token) {
    const refreshTokenPayload = {
      userId: user.id /*, version: user.token_version */,
    }; // Adicionar versionamento se necessário
    refreshTokenToStoreAndReturn = jwt.sign(refreshTokenPayload, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    // Atualiza o refresh token no banco de dados
    await knex("users").where({ id: user.id }).update({
      refresh_token: refreshTokenToStoreAndReturn,
      updated_at: knex.fn.now(),
    });
  }

  return { accessToken, refreshToken: refreshTokenToStoreAndReturn };
}

/**
 * Registra um novo usuário.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} userData - Dados do usuário { name, email, password }.
 * @returns {Promise<{user: object, tokens: object}>}
 */
async function registerUser(fastify, { name, email, password }) {
  const { knex, bcrypt, log } = fastify; // 'bcrypt' é o decorator do plugin bcryptUtils

  const existingUser = await knex("users").where({ email }).first();
  if (existingUser) {
    const error = new Error("E-mail já cadastrado.");
    error.statusCode = 409;
    error.code = "AUTH_EMAIL_EXISTS";
    throw error;
  }

  const passwordHash = await bcrypt.hash(password);
  const [newUserFromDB] = await knex("users")
    .insert({
      name,
      email,
      password_hash: passwordHash,
      role: "user", // Papel padrão
      status: "active", // Status padrão
    })
    .returning(["id", "public_id", "name", "email", "role", "refresh_token"]); // Inclui refresh_token para _generateUserTokens

  const freePlan = await knex("plans").where({ name: "Gratuito" }).first();
  if (freePlan) {
    await knex("user_plan_subscriptions").insert({
      user_id: newUserFromDB.id,
      plan_id: freePlan.id,
      status: "active",
      started_at: knex.fn.now(),
    });
  } else {
    log.warn(
      `[AuthService] Plano gratuito padrão não encontrado para o usuário ${newUserFromDB.id}`
    );
  }

  // Passa o usuário recém-criado (com refresh_token potencialmente nulo) para gerar os tokens
  // _generateUserTokens irá criar e salvar o primeiro refresh token.
  const tokens = await _generateUserTokens(fastify, newUserFromDB, true); // true para garantir que um RT seja gerado e salvo

  // Retorna apenas os campos seguros do usuário
  const safeUser = {
    id: newUserFromDB.public_id,
    name: newUserFromDB.name,
    email: newUserFromDB.email,
    role: newUserFromDB.role,
  };
  return { user: safeUser, tokens };
}

/**
 * Autentica um usuário existente.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} credentials - { email, password }.
 * @returns {Promise<{user: object, tokens: object}>}
 */
async function loginUser(fastify, { email, password }) {
  const { knex, bcrypt, log } = fastify;
  const user = await knex("users").where({ email }).first(); // Pega todos os campos, incluindo refresh_token

  if (!user) {
    const error = new Error("Credenciais inválidas.");
    error.statusCode = 401;
    error.code = "AUTH_INVALID_CREDENTIALS";
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    const error = new Error("Credenciais inválidas.");
    error.statusCode = 401;
    error.code = "AUTH_INVALID_CREDENTIALS";
    throw error;
  }

  if (user.status !== "active") {
    const error = new Error("Conta de usuário não está ativa.");
    error.statusCode = 403;
    error.code = "AUTH_ACCOUNT_INACTIVE";
    throw error;
  }

  // Gera novos tokens, rotacionando o refresh token (boa prática no login)
  const tokens = await _generateUserTokens(fastify, user, true);
  const userResponse = {
    id: user.public_id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  return { user: userResponse, tokens };
}

/**
 * Inicia o processo de recuperação de senha.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} data - { email }.
 * @returns {Promise<{message: string}>}
 */
async function initiatePasswordReset(fastify, { email }) {
  const { knex, cryptoUtils, config, mailer, log } = fastify;

  // Obtém valores do config (originados do .env)
  const PASSWORD_RESET_TOKEN_EXPIRES_IN_MS =
    config.PASSWORD_RESET_TOKEN_EXPIRES_IN_MS;
  const APP_NAME = config.EMAIL_FROM_NAME || "Empresor"; // Use EMAIL_FROM_NAME
  const LOGO_URL = config.COMPANY_LOGO_URL;
  const PRIMARY_COLOR = config.EMAIL_PRIMARY_COLOR;

  const user = await knex("users").where({ email }).first();

  if (user && user.status === "active") {
    const plainToken = cryptoUtils.generateRandomHexString(32);
    const hashedToken = cryptoUtils.hashSha256(plainToken);
    const expires = new Date(
      Date.now() + Number(PASSWORD_RESET_TOKEN_EXPIRES_IN_MS)
    );

    await knex("users").where({ id: user.id }).update({
      password_reset_token: hashedToken,
      password_reset_expires: expires,
      updated_at: knex.fn.now(),
    });

    const resetLink = `${config.FRONTEND_URL}/reset-password?token=${plainToken}`;
    const tokenExpiryMinutes = Math.round(
      Number(PASSWORD_RESET_TOKEN_EXPIRES_IN_MS) / (60 * 1000)
    );

    // Gera o HTML do e-mail
    const emailHtml = getPasswordResetEmailHTML({
      userName: user.name,
      resetLink: resetLink,
      appName: APP_NAME,
      logoUrl: LOGO_URL,
      primaryColor: PRIMARY_COLOR,
      tokenExpiryMinutes: tokenExpiryMinutes,
    });

    if (mailer && typeof mailer.sendMail === "function") {
      try {
        await mailer.sendMail({
          from: config.EMAIL_FROM, // Ex: '"Empresor" <nao-responda@empresor.com>'
          to: user.email,
          subject: `Redefinição de Senha - ${APP_NAME}`,
          html: emailHtml, // Usa o template HTML gerado
        });
        log.info(
          `[AuthService] E-mail de recuperação de senha enviado para ${user.email}`
        );
      } catch (emailError) {
        log.error(
          emailError,
          `[AuthService] Falha ao enviar e-mail de recuperação para ${user.email}`
        );
      }
    } else {
      log.error(
        "[AuthService] Serviço de e-mail (fastify.mailer) não configurado."
      );
      log.warn(
        `[AuthService] Link de reset para ${user.email} (simulado, e-mail não enviado): ${resetLink}`
      );
      // Para debug, você pode logar o HTML gerado:
      // log.debug({ emailHtml }, 'HTML do e-mail de reset gerado (não enviado)');
    }
  } else {
    log.info(
      `[AuthService] Tentativa de recuperação de senha para e-mail não existente ou inativo: ${email}`
    );
  }

  return {
    message:
      "Se um usuário ativo com este e-mail existir em nosso sistema, um link de recuperação de senha foi enviado.",
  };
}

/**
 * Completa a redefinição de senha.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} data - { plainToken, newPassword }.
 * @returns {Promise<{message: string}>}
 */
async function completePasswordReset(fastify, { plainToken, newPassword }) {
  const { knex, cryptoUtils, bcrypt, log } = fastify;

  const hashedToken = cryptoUtils.hashSha256(plainToken);
  const user = await knex("users")
    .where({ password_reset_token: hashedToken })
    .andWhere("password_reset_expires", ">", knex.fn.now())
    .first();

  if (!user) {
    const error = new Error("Token de redefinição inválido ou expirado.");
    error.statusCode = 400;
    error.code = "AUTH_INVALID_RESET_TOKEN";
    throw error;
  }

  if (user.status !== "active") {
    const error = new Error(
      "A conta do usuário não está ativa para redefinição de senha."
    );
    error.statusCode = 400;
    error.code = "AUTH_ACCOUNT_INACTIVE_FOR_RESET";
    throw error;
  }

  const newPasswordHash = await bcrypt.hash(newPassword);
  await knex("users").where({ id: user.id }).update({
    password_hash: newPasswordHash,
    password_reset_token: null,
    password_reset_expires: null,
    refresh_token: null, // Invalida sessões antigas/refresh tokens como medida de segurança
    updated_at: knex.fn.now(),
  });

  log.info(
    `[AuthService] Senha redefinida com sucesso para o usuário ID: ${user.id}`
  );
  return { message: "Senha redefinida com sucesso." };
}

/**
 * Processa um refreshToken para gerar um novo accessToken (e opcionalmente um novo refreshToken).
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} data - { providedRefreshToken }.
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
async function handleRefreshToken(fastify, { providedRefreshToken }) {
  const { jwt, knex, log } = fastify;

  let decodedRefreshTokenPayload;
  try {
    decodedRefreshTokenPayload = jwt.verify(providedRefreshToken);
  } catch (err) {
    log.warn(
      err,
      "[AuthService] Tentativa de refresh com token JWT inválido ou expirado (falha na verificação)."
    );
    const error = new Error("Refresh token inválido ou expirado.");
    error.statusCode = 401;
    error.code = "AUTH_INVALID_REFRESH_TOKEN";
    throw error;
  }

  const { userId } = decodedRefreshTokenPayload;
  const user = await knex("users").where({ id: userId }).first();

  if (!user) {
    log.warn(
      `[AuthService] Usuário não encontrado para refresh token (userId: ${userId}). Token pode ser de usuário deletado.`
    );
    const error = new Error("Refresh token inválido.");
    error.statusCode = 401;
    error.code = "AUTH_USER_NOT_FOUND_FOR_REFRESH";
    throw error;
  }

  if (user.status !== "active") {
    log.warn(
      `[AuthService] Conta inativa tentando refresh token (userId: ${userId}).`
    );
    const error = new Error("Conta de usuário não está ativa.");
    error.statusCode = 401;
    error.code = "AUTH_ACCOUNT_INACTIVE_FOR_REFRESH";
    throw error;
  }

  if (user.refresh_token !== providedRefreshToken) {
    log.warn(
      `[AuthService] Refresh token fornecido não corresponde ao armazenado para userId: ${userId}. Possível reuso de token ou token revogado. Invalidando tokens do usuário.`
    );
    // Medida de segurança: se houver uma tentativa de usar um refresh token que não é o mais recente,
    // invalide todos os refresh tokens do usuário, pois pode indicar um comprometimento.
    await knex("users")
      .where({ id: userId })
      .update({ refresh_token: null, updated_at: knex.fn.now() });
    const error = new Error("Refresh token inválido ou revogado.");
    error.statusCode = 401;
    error.code = "AUTH_REFRESH_TOKEN_MISMATCH_OR_REVOKED";
    throw error;
  }

  // Gera novo accessToken e ROTACIONA o refreshToken (boa prática)
  // Passamos o objeto 'user' que já contém o 'refresh_token' atual para a lógica de rotação em _generateUserTokens
  const newTokens = await _generateUserTokens(fastify, user, true);

  log.info(`[AuthService] Refresh token bem-sucedido para userId: ${userId}`);
  return newTokens;
}

/**
 * Realiza o logout do usuário invalidando seu refreshToken.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} data - { userId }. O userId vem do accessToken do usuário autenticado.
 * @returns {Promise<{message: string}>}
 */
async function logoutUser(fastify, { userId }) {
  const { knex, log } = fastify;

  const user = await knex("users").where({ id: userId }).first();

  if (!user) {
    // Isso não deveria acontecer se a rota de logout for protegida e userId vier de um accessToken válido.
    log.error(
      `[AuthService] Tentativa de logout para usuário inexistente: ${userId}`
    );
    const error = new Error("Usuário não encontrado.");
    error.statusCode = 404;
    error.code = "AUTH_USER_NOT_FOUND_FOR_LOGOUT";
    throw error;
  }

  // Se o usuário já não tiver um refresh_token (ex: já fez logout), não há nada a fazer.
  if (user.refresh_token === null) {
    log.info(
      `[AuthService] Usuário ID: ${userId} já estava efetivamente deslogado (sem refresh token).`
    );
    return {
      message: "Logout realizado com sucesso (sessão já estava inativa).",
    };
  }

  await knex("users").where({ id: userId }).update({
    refresh_token: null, // Invalida o refresh token
    updated_at: knex.fn.now(),
  });

  log.info(
    `[AuthService] Logout bem-sucedido para userId: ${userId}. Refresh token invalidado.`
  );
  return { message: "Logout realizado com sucesso." };
}

module.exports = {
  registerUser,
  loginUser,
  initiatePasswordReset,
  completePasswordReset,
  handleRefreshToken,
  logoutUser,
};
