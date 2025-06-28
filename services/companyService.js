"use strict";

const cloudinary = require("cloudinary").v2;
const {
  getCompanyVerificationEmailHTML,
} = require("../utils/verificationEmailTemplate");

function mapCompanyPublicId(company) {
  if (!company) return null;
  const {
    id: _ignored,
    public_id,
    owner_id,
    owner_public_id,
    ...rest
  } = company;
  return {
    id: public_id,
    owner_id: owner_public_id || owner_id,
    ...rest,
  };
}

class CompanyService {
  constructor() {}

  async _resolveCompanyId(knex, identifier) {
    if (!isNaN(parseInt(identifier))) {
      return parseInt(identifier);
    }
    const row = await knex("companies")
      .select("id")
      .where("public_id", identifier)
      .first();
    return row ? row.id : null;
  }

  async _resolveUserId(knex, identifier) {
    if (!identifier) return null;
    if (!isNaN(parseInt(identifier))) {
      return parseInt(identifier);
    }
    const row = await knex("users")
      .select("id")
      .where("public_id", identifier)
      .first();
    return row ? row.id : null;
  }

  /**
   * Método auxiliar privado para gerar e enviar o e-mail de verificação.
   * Centraliza a lógica de envio para ser usada na criação e no reenvio.
   * @private
   */
  async _sendVerificationEmail(fastify, company) {
    // Verifica se o plugin de e-mail está configurado e disponível.
    if (!fastify.mailer) {
      fastify.log.error(
        "Serviço de e-mail (fastify.mailer) não está disponível. Verifique o plugin e as configurações .env."
      );
      throw new Error(
        "Não foi possível enviar o e-mail de verificação pois o serviço de e-mail não está configurado."
      );
    }

    // Garante que a empresa tenha um e-mail para onde enviar.
    if (!company.email) {
      throw new Error(
        "A empresa não possui um e-mail cadastrado para enviar a verificação."
      );
    }

    // Gera um novo código de 6 dígitos e uma data de expiração de 15 minutos.
    const validationCode = fastify.cryptoUtils.generateNumericCode(6);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Salva o novo código e a data de expiração no banco de dados.
    await fastify.knex("companies").where("id", company.id).update({
      validation_code: validationCode,
      validation_code_expires_at: expiresAt,
    });

    // Gera o HTML do e-mail usando o template estilizado.
    const emailHtml = getCompanyVerificationEmailHTML({
      companyName: company.name,
      verificationCode: validationCode,
      appName: fastify.config.EMAIL_FROM_NAME,
      logoUrl: fastify.config.COMPANY_LOGO_URL,
      primaryColor: fastify.config.EMAIL_PRIMARY_COLOR,
      codeExpiryMinutes: 15,
    });

    // Define as opções do e-mail para o Nodemailer.
    const mailOptions = {
      from: fastify.config.EMAIL_FROM,
      to: company.email,
      subject: `[${validationCode}] é o seu código de verificação para ${fastify.config.EMAIL_FROM_NAME}`,
      html: emailHtml,
    };

    // Envia o e-mail.
    try {
      await fastify.mailer.sendMail(mailOptions);
      fastify.log.info(
        `E-mail de verificação enviado com sucesso para ${company.email}`
      );
    } catch (error) {
      fastify.log.error(
        error,
        "Falha ao enviar e-mail de verificação via fastify.mailer"
      );
      throw new Error("Ocorreu uma falha ao enviar o e-mail de verificação.");
    }
  }

  /**
   * Cria uma nova empresa. Se um CNPJ for fornecido, a empresa
   * começa com status 'pending_validation' e um e-mail é enviado.
   */
  async createCompany(fastify, userId, companyData) {
    const { document_number } = companyData;
    const companyToInsert = {
      owner_id: userId,
      name: companyData.name,
      legal_name: companyData.legal_name,
      document_number: document_number,
      email: companyData.email,
      phone_number: companyData.phone_number,
      address_street: companyData.address_street,
      address_number: companyData.address_number,
      address_complement: companyData.address_complement,
      address_neighborhood: companyData.address_neighborhood,
      address_city: companyData.address_city,
      address_state: companyData.address_state,
      address_zip_code: companyData.address_zip_code,
      address_country: companyData.address_country || "BR",
      pdf_preferences: companyData.pdf_preferences || {},
      status: document_number ? "pending_validation" : "active",
    };

    try {
      const [createdCompany] = await fastify
        .knex("companies")
        .insert(companyToInsert)
        .returning("*");

      if (createdCompany.status === "pending_validation") {
        await this._sendVerificationEmail(fastify, createdCompany);
      }

      return this.getCompanyById(
        fastify,
        userId,
        createdCompany.public_id
      );
    } catch (error) {
      fastify.log.error(error, "Erro ao criar empresa no banco de dados");

      // *** CORREÇÃO APLICADA AQUI ***
      // Verifica pelo código de erro do PostgreSQL (23505) em vez da mensagem de texto.
      if (error.code === "23505") {
        const customError = new Error(
          "Falha ao criar empresa: um registro com o número de documento fornecido já existe."
        );
        customError.statusCode = 409; // 409 Conflict
        customError.code = "Conflict";
        throw customError;
      }

      // Se for qualquer outro erro, lança o erro genérico.
      throw new Error("Não foi possível criar a empresa.");
    }
  }

  /**
   * Verifica o código da empresa e, se for válido, ativa o status.
   */
  async verifyCompany(fastify, userId, companyId, validationCode) {
    const company = await this.getCompanyById(fastify, userId, companyId);

    if (company.status === "active") {
      const error = new Error("Esta empresa já foi validada.");
      error.statusCode = 409;
      throw error;
    }

    const isCodeValid = company.validation_code === validationCode;
    const isExpired = new Date() > new Date(company.validation_code_expires_at);

    if (!isCodeValid || isExpired) {
      const error = new Error("Código de verificação inválido ou expirado.");
      error.statusCode = 400;
      throw error;
    }

    const id = await this._resolveCompanyId(fastify.knex, companyId);
    const [activatedCompany] = await fastify
      .knex("companies")
      .where("id", id)
      .update({
        status: "active",
        validation_code: null,
        validation_code_expires_at: null,
      })
      .returning("*");

    return this.getCompanyById(fastify, userId, companyId);
  }

  /**
   * Reenvia um novo código de verificação para uma empresa com status pendente.
   */
  async resendValidationEmail(fastify, userId, companyId) {
    // Reutiliza getCompanyById para buscar a empresa e checar a permissão.
    const company = await this.getCompanyById(fastify, userId, companyId);

    // Verifica se a empresa realmente precisa de validação.
    if (company.status !== "pending_validation") {
      const error = new Error("Esta empresa não está aguardando validação.");
      error.statusCode = 409;
      error.code = "Conflict";
      throw error;
    }

    // Reutiliza a lógica de envio de e-mail.
    await this._sendVerificationEmail(fastify, company);

    return { message: "E-mail de verificação reenviado com sucesso." };
  }

  async listCompanies(fastify, userId, queryParams) {
    const {
      page = 1,
      pageSize = 10,
      name,
      status,
      owner_id,
      document_number,
    } = queryParams;
    const offset = (page - 1) * pageSize;

    let query = fastify
      .knex("companies as c")
      .leftJoin("users as u", "c.owner_id", "u.id")
      .select("c.*", "u.public_id as owner_public_id");
    let countQuery = fastify.knex("companies as c").count("c.id as total");

    if (owner_id && owner_id !== String(userId)) {
      const ownerInternalId = await this._resolveUserId(
        fastify.knex,
        owner_id
      );
      if (ownerInternalId) {
        query = query.where("c.owner_id", ownerInternalId);
        countQuery = countQuery.where("c.owner_id", ownerInternalId);
      }
    } else if (!owner_id) {
      query = query.where("c.owner_id", userId);
      countQuery = countQuery.where("c.owner_id", userId);
    }

    if (name) {
      query = query.where("name", "like", `%${name}%`);
      countQuery = countQuery.where("name", "like", `%${name}%`);
    }
    if (status) {
      query = query.where("status", status);
      countQuery = countQuery.where("status", status);
    }
    if (document_number) {
      query = query.where("document_number", document_number);
      countQuery = countQuery.where("document_number", document_number);
    }

    try {
      const companies = await query
        .orderBy("name", "asc")
        .limit(pageSize)
        .offset(offset);
      const [{ total: totalItems }] = await countQuery;
      const totalPages = Math.ceil(totalItems / pageSize);

      return {
        data: companies.map(mapCompanyPublicId),
        pagination: {
          totalItems: parseInt(totalItems),
          totalPages,
          currentPage: parseInt(page),
          pageSize: parseInt(pageSize),
        },
      };
    } catch (error) {
      fastify.log.error(error, "Erro ao listar empresas");
      throw new Error("Não foi possível listar as empresas.");
    }
  }

  async getCompanyById(fastify, userId, companyId) {
    try {
      const query = fastify
        .knex("companies as c")
        .leftJoin("users as u", "c.owner_id", "u.id")
        .select("c.*", "u.public_id as owner_public_id");

      if (!isNaN(parseInt(companyId))) {
        query.where("c.id", companyId);
      } else {
        query.where("c.public_id", companyId);
      }

      const company = await query.first();

      if (!company) {
        const error = new Error("Empresa não encontrada.");
        error.statusCode = 404;
        error.code = "NotFound";
        throw error;
      }

      if (company.owner_id !== userId) {
        const error = new Error("Acesso proibido a esta empresa.");
        error.statusCode = 403;
        error.code = "Forbidden";
        throw error;
      }

      return mapCompanyPublicId(company);
    } catch (error) {
      if (error.statusCode) throw error;
      fastify.log.error(error, `Erro ao obter empresa por ID: ${companyId}`);
      throw new Error("Não foi possível obter a empresa.");
    }
  }

  async updateCompany(fastify, userId, companyId, updateData) {
    await this.getCompanyById(fastify, userId, companyId);

    const updatePayload = { ...updateData, updated_at: fastify.knex.fn.now() };

    try {
      const id = await this._resolveCompanyId(fastify.knex, companyId);
      const [updatedCompany] = await fastify
        .knex("companies")
        .where("id", id)
        .update(updatePayload)
        .returning("*");
      return this.getCompanyById(fastify, userId, companyId);
    } catch (error) {
      fastify.log.error(error, `Erro ao atualizar empresa ID: ${companyId}`);
      if (
        error.code === "SQLITE_CONSTRAINT" ||
        error.message.includes("UNIQUE constraint failed") ||
        error.message.includes("duplicate key value violates unique constraint")
      ) {
        const customError = new Error(
          "Falha ao atualizar empresa: um registro com o número de documento fornecido já existe."
        );
        customError.statusCode = 409;
        customError.code = "Conflict";
        throw customError;
      }
      throw new Error("Não foi possível atualizar a empresa.");
    }
  }

  async deleteCompany(fastify, userId, companyId) {
    const company = await this.getCompanyById(fastify, userId, companyId);

    if (company.status === "inactive") {
      return { message: "Empresa já está inativa." };
    }

    try {
      const id = await this._resolveCompanyId(fastify.knex, companyId);
      await fastify
        .knex("companies")
        .where("id", id)
        .update({ status: "inactive", updated_at: fastify.knex.fn.now() });
      return { message: "Empresa desativada com sucesso." };
    } catch (error) {
      fastify.log.error(error, `Erro ao desativar empresa ID: ${companyId}`);
      throw new Error("Não foi possível desativar a empresa.");
    }
  }

  async uploadCompanyLogo(fastify, userId, companyId, fileData) {
    await this.getCompanyById(fastify, userId, companyId);

    if (!cloudinary.config().cloud_name) {
      if (
        fastify.config.CLOUDINARY_CLOUD_NAME &&
        fastify.config.CLOUDINARY_API_KEY &&
        fastify.config.CLOUDINARY_API_SECRET
      ) {
        cloudinary.config({
          cloud_name: fastify.config.CLOUDINARY_CLOUD_NAME,
          api_key: fastify.config.CLOUDINARY_API_KEY,
          api_secret: fastify.config.CLOUDINARY_API_SECRET,
          secure: true,
        });
        fastify.log.info(
          "Cloudinary SDK configurado dinamicamente para upload de logo."
        );
      } else {
        fastify.log.error(
          "Credenciais do Cloudinary não encontradas na configuração. Upload de logo falhará."
        );
        throw new Error(
          "Serviço de upload de imagem não está configurado corretamente."
        );
      }
    }

    const uploadStreamToCloudinary = (fileStream) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `empresor/company_logos/${companyId}`,
            public_id: `logo_${Date.now()}`,
          },
          (error, result) => {
            if (error) {
              return reject(error);
            }
            resolve(result);
          }
        );
        fileStream.pipe(stream);
      });
    };

    let uploadResult;
    try {
      fastify.log.info(
        `Iniciando upload para Cloudinary para empresa ${companyId}, arquivo: ${fileData.filename}`
      );
      uploadResult = await uploadStreamToCloudinary(fileData.file);
      fastify.log.info(
        `Upload para Cloudinary bem-sucedido para empresa ${companyId}. URL: ${uploadResult.secure_url}`
      );
    } catch (error) {
      fastify.log.error(
        error,
        "Erro ao fazer upload do logo para o Cloudinary"
      );
      const serviceError = new Error(
        "Falha no upload do logo para o serviço de armazenamento."
      );
      serviceError.statusCode = 502;
      throw serviceError;
    }

    if (!uploadResult || !uploadResult.secure_url) {
      fastify.log.error(
        "Upload para o Cloudinary não retornou uma URL válida."
      );
      throw new Error("Falha ao obter URL do logo após o upload.");
    }

    const logoUrl = uploadResult.secure_url;

    try {
      const id = await this._resolveCompanyId(fastify.knex, companyId);
      const [updatedCompany] = await fastify
        .knex("companies")
        .where("id", id)
        .update({ logo_url: logoUrl, updated_at: fastify.knex.fn.now() })
        .returning(["id", "name", "logo_url", "status", "updated_at"]);

      fastify.log.info(
        `URL do logo atualizada no banco de dados para empresa ${companyId}.`
      );
      return {
        message: "Logo atualizado com sucesso!",
        company: mapCompanyPublicId(updatedCompany),
      };
    } catch (dbError) {
      fastify.log.error(
        dbError,
        `Erro ao atualizar URL do logo no banco de dados para empresa ID: ${companyId}`
      );
      throw new Error(
        "Não foi possível salvar a URL do logo da empresa no banco de dados."
      );
    }
  }
}

module.exports = new CompanyService();
