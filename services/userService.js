"use strict";

async function getUserProfile(fastify, userId) {
  const { knex, log } = fastify;

  const user = await knex("users")
    .select("id", "name", "email", "role", "status", "created_at")
    .where({ id: userId })
    .first();

  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.statusCode = 404;
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  // Buscar plano ativo
  const activeSubscription = await knex("user_plan_subscriptions as ups")
    .join("plans as p", "ups.plan_id", "p.id")
    .select(
      "p.name as plan_name",
      "ups.status",
      "ups.trial_ends_at",
      "ups.current_period_ends_at"
    )
    .where("ups.user_id", userId)
    // Adicione lógica para pegar o mais relevante se houver múltiplos (ex: o mais recente, ou com status 'active'/'trialing')
    .andWhereIn("ups.status", ["active", "trialing", "free"]) // Considera estes como "ativos" para exibição
    .orderBy("ups.created_at", "desc")
    .first();

  user.active_plan = activeSubscription || null;

  return user;
}

async function updateUserProfile(fastify, userId, updateData) {
  const { knex, bcrypt, log } = fastify; // 'bcrypt' é o decorator do plugin bcryptUtils
  const { name, email, currentPassword, newPassword } = updateData;

  const userToUpdate = await knex("users").where({ id: userId }).first();
  if (!userToUpdate) {
    const error = new Error("Usuário não encontrado.");
    error.statusCode = 404;
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  const dataToUpdate = { updated_at: knex.fn.now() };

  if (name) {
    dataToUpdate.name = name;
  }

  if (email && email !== userToUpdate.email) {
    const existingEmailUser = await knex("users")
      .where({ email })
      .whereNot({ id: userId })
      .first();
    if (existingEmailUser) {
      const error = new Error("Este e-mail já está em uso por outra conta.");
      error.statusCode = 409;
      error.code = "USER_EMAIL_CONFLICT";
      throw error;
    }
    dataToUpdate.email = email;
    // Considere lógica adicional se o e-mail precisar ser verificado novamente.
  }

  if (newPassword) {
    if (!currentPassword) {
      const error = new Error(
        "Senha atual é necessária para definir uma nova senha."
      );
      error.statusCode = 400;
      error.code = "USER_PASSWORD_UPDATE_CURRENT_MISSING";
      throw error;
    }
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      userToUpdate.password_hash
    );
    if (!isPasswordValid) {
      const error = new Error("Senha atual incorreta.");
      error.statusCode = 400;
      error.code = "USER_PASSWORD_UPDATE_CURRENT_INVALID";
      throw error;
    }
    dataToUpdate.password_hash = await bcrypt.hash(newPassword);
    dataToUpdate.refresh_token = null; // Invalida sessões existentes ao mudar senha
  }

  if (Object.keys(dataToUpdate).length === 1 && dataToUpdate.updated_at) {
    // Nada para atualizar além do timestamp
    log.info(
      `[UserService] Nenhuma alteração de dados para o usuário ${userId}.`
    );
    // Retorna o perfil atual sem fazer update desnecessário
    return getUserProfile(fastify, userId);
  }

  await knex("users").where({ id: userId }).update(dataToUpdate);
  log.info(`[UserService] Perfil do usuário ${userId} atualizado.`);

  // Retorna o perfil completo e atualizado
  return getUserProfile(fastify, userId);
}

async function deleteUserAccount(fastify, userId) {
  const { knex, log } = fastify;

  const user = await knex("users").where({ id: userId }).first();
  if (!user) {
    const error = new Error("Usuário não encontrado.");
    error.statusCode = 404;
    error.code = "USER_NOT_FOUND";
    throw error;
  }

  if (user.status === "deleted") {
    log.info(`[UserService] Usuário ${userId} já estava desativado.`);
    return { message: "Conta já estava desativada." };
  }

  // Soft delete
  await knex("users")
    .where({ id: userId })
    .update({
      status: "deleted", // ou 'inactive'
      email: `${user.email}_deleted_${Date.now()}`, // Anonimiza o e-mail para permitir reuso futuro se necessário
      refresh_token: null,
      password_reset_token: null,
      password_reset_expires: null,
      // deleted_at: knex.fn.now(), // Se tiver uma coluna deleted_at
      updated_at: knex.fn.now(),
    });

  // Considere o que fazer com user_plan_subscriptions: cancelar?
  // await knex('user_plan_subscriptions').where({ user_id: userId }).update({ status: 'canceled', ended_at: knex.fn.now() });

  log.info(
    `[UserService] Conta do usuário ${userId} desativada (soft delete).`
  );
  return { message: "Sua conta foi desativada com sucesso." };
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
};
