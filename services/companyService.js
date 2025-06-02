"use strict";

const cloudinary = require("cloudinary").v2;

class CompanyService {
  constructor() {
    // A configuração do Cloudinary foi movida para dentro do método uploadCompanyLogo
    // para garantir que `fastify.config` esteja acessível.
    // Idealmente, configure uma vez no bootstrap da aplicação.
  }

  async createCompany(fastify, userId, companyData) {
    const {
      name,
      legal_name,
      document_number,
      email,
      phone_number,
      ...addressAndPrefs
    } = companyData;

    const companyToInsert = {
      owner_id: userId,
      name,
      legal_name,
      document_number,
      email,
      phone_number,
      address_street: addressAndPrefs.address_street,
      address_number: addressAndPrefs.address_number,
      address_complement: addressAndPrefs.address_complement,
      address_neighborhood: addressAndPrefs.address_neighborhood,
      address_city: addressAndPrefs.address_city,
      address_state: addressAndPrefs.address_state,
      address_zip_code: addressAndPrefs.address_zip_code,
      address_country: addressAndPrefs.address_country || "BR",
      pdf_preferences: addressAndPrefs.pdf_preferences || {},
      status: addressAndPrefs.status || "active",
    };

    try {
      const [createdCompany] = await fastify
        .knex("companies")
        .insert(companyToInsert)
        .returning("*");
      return createdCompany;
    } catch (error) {
      fastify.log.error(error, "Erro ao criar empresa no banco de dados");
      if (
        error.code === "SQLITE_CONSTRAINT" ||
        error.message.includes("UNIQUE constraint failed") ||
        error.message.includes("duplicate key value violates unique constraint")
      ) {
        const customError = new Error(
          "Falha ao criar empresa: um registro com o número de documento fornecido já existe."
        );
        customError.statusCode = 409;
        customError.code = "Conflict";
        throw customError;
      }
      throw new Error("Não foi possível criar a empresa.");
    }
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

    let query = fastify.knex("companies");
    let countQuery = fastify.knex("companies").count("id as total");

    if (owner_id && parseInt(owner_id) !== userId) {
      query = query.where("owner_id", parseInt(owner_id));
      countQuery = countQuery.where("owner_id", parseInt(owner_id));
    } else if (!owner_id) {
      query = query.where("owner_id", userId);
      countQuery = countQuery.where("owner_id", userId);
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
        data: companies,
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
      const company = await fastify
        .knex("companies")
        .where("id", companyId)
        .first();

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

      return company;
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
      const [updatedCompany] = await fastify
        .knex("companies")
        .where("id", companyId)
        .update(updatePayload)
        .returning("*");
      return updatedCompany;
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
      await fastify
        .knex("companies")
        .where("id", companyId)
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
      const [updatedCompany] = await fastify
        .knex("companies")
        .where("id", companyId)
        .update({ logo_url: logoUrl, updated_at: fastify.knex.fn.now() })
        .returning(["id", "name", "logo_url", "status", "updated_at"]);

      fastify.log.info(
        `URL do logo atualizada no banco de dados para empresa ${companyId}.`
      );
      return {
        message: "Logo atualizado com sucesso!",
        company: updatedCompany,
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
