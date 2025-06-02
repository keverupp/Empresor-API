// services/companyService.js
"use strict";

// Importe o SDK do Cloudinary. Certifique-se de que está listado em suas dependências.
// const cloudinary = require('cloudinary').v2; // Descomente quando for integrar

class CompanyService {
  constructor() {
    // Descomente e configure o Cloudinary quando estiver pronto para integrar
    // if (fastify.config.CLOUDINARY_CLOUD_NAME && fastify.config.CLOUDINARY_API_KEY && fastify.config.CLOUDINARY_API_SECRET) {
    //   cloudinary.config({
    //     cloud_name: fastify.config.CLOUDINARY_CLOUD_NAME,
    //     api_key: fastify.config.CLOUDINARY_API_KEY,
    //     api_secret: fastify.config.CLOUDINARY_API_SECRET,
    //     secure: true,
    //   });
    // } else {
    //   // Log um aviso se o Cloudinary não estiver configurado mas o serviço for usado
    //   // fastify.log.warn('Cloudinary não está configurado. Upload de logo não funcionará.');
    // }
  }

  /**
   * Cria uma nova empresa.
   * @param {import("fastify").FastifyInstance} fastify - Instância do Fastify.
   * @param {number} userId - ID do usuário proprietário.
   * @param {object} companyData - Dados da empresa do corpo da requisição.
   * @returns {Promise<object>} A empresa criada.
   */
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
      owner_id: userId, // [cite: 1]
      name, // [cite: 1]
      legal_name, // [cite: 1]
      document_number, // [cite: 1]
      email, // [cite: 1]
      phone_number, // [cite: 1]
      address_street: addressAndPrefs.address_street, // [cite: 1]
      address_number: addressAndPrefs.address_number, // [cite: 1]
      address_complement: addressAndPrefs.address_complement, // [cite: 1]
      address_neighborhood: addressAndPrefs.address_neighborhood, // [cite: 1]
      address_city: addressAndPrefs.address_city, // [cite: 1]
      address_state: addressAndPrefs.address_state, // [cite: 1]
      address_zip_code: addressAndPrefs.address_zip_code, // [cite: 1]
      address_country: addressAndPrefs.address_country || "BR", // [cite: 1]
      pdf_preferences: addressAndPrefs.pdf_preferences || {}, // [cite: 1]
      status: addressAndPrefs.status || "active", // [cite: 1]
      // created_at e updated_at são definidos por padrão pelo Knex/DB [cite: 1]
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
        // Verifique se o erro é de constraint única (ex: document_number)
        const customError = new Error(
          "Falha ao criar empresa: um registro com o número de documento fornecido já existe."
        );
        customError.statusCode = 409; // Conflict
        customError.code = "Conflict";
        throw customError;
      }
      throw new Error("Não foi possível criar a empresa.");
    }
  }

  /**
   * Lista empresas com base nos parâmetros de consulta.
   * @param {import("fastify").FastifyInstance} fastify - Instância do Fastify.
   * @param {number} userId - ID do usuário autenticado (para verificação de permissão).
   * @param {object} queryParams - Parâmetros de consulta (page, pageSize, name, status, etc.).
   * @returns {Promise<object>} Objeto com dados e informações de paginação.
   */
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

    // Inicia a query para buscar empresas
    let query = fastify.knex("companies");
    // Inicia a query para contar o total de itens (para paginação)
    let countQuery = fastify.knex("companies").count("id as total");

    // Filtro básico: por padrão, um usuário só vê suas próprias empresas.
    // Se um admin puder ver todas, ou filtrar por owner_id, essa lógica precisará ser ajustada.
    // Por enquanto, vamos assumir que o owner_id no queryParams é para um admin,
    // ou o usuário está listando apenas as suas.
    if (
      owner_id &&
      parseInt(owner_id) !== userId /* && !isUserAdmin(userId) */
    ) {
      // Se o owner_id é fornecido e não é o usuário logado (e o usuário não é admin),
      // pode ser um caso de acesso proibido ou apenas não retornar nada.
      // Por simplicidade, vamos permitir que o filtro owner_id seja aplicado.
      // Em um cenário real, verificar se o `userId` tem permissão para ver `owner_id`.
      query = query.where("owner_id", parseInt(owner_id));
      countQuery = countQuery.where("owner_id", parseInt(owner_id));
    } else if (!owner_id /* && !isUserAdmin(userId) */) {
      // Se nenhum owner_id é especificado (e não é admin), lista apenas as do usuário logado.
      query = query.where("owner_id", userId);
      countQuery = countQuery.where("owner_id", userId);
    }
    // Se for admin e owner_id não estiver no query, não filtra por owner_id (mostra todos).

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

  /**
   * Obtém uma empresa específica por ID.
   * @param {import("fastify").FastifyInstance} fastify - Instância do Fastify.
   * @param {number} userId - ID do usuário autenticado.
   * @param {number} companyId - ID da empresa a ser obtida.
   * @returns {Promise<object>} A empresa encontrada.
   */
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

      // Verificação de permissão (usuário só pode ver sua própria empresa, a menos que seja admin)
      if (company.owner_id !== userId /* && !isUserAdmin(userId) */) {
        const error = new Error("Acesso proibido a esta empresa.");
        error.statusCode = 403; // Forbidden
        error.code = "Forbidden";
        throw error;
      }

      return company;
    } catch (error) {
      if (error.statusCode) throw error; // Re-throw erros já formatados
      fastify.log.error(error, `Erro ao obter empresa por ID: ${companyId}`);
      throw new Error("Não foi possível obter a empresa.");
    }
  }

  /**
   * Atualiza uma empresa existente.
   * @param {import("fastify").FastifyInstance} fastify - Instância do Fastify.
   * @param {number} userId - ID do usuário autenticado.
   * @param {number} companyId - ID da empresa a ser atualizada.
   * @param {object} updateData - Dados para atualização.
   * @returns {Promise<object>} A empresa atualizada.
   */
  async updateCompany(fastify, userId, companyId, updateData) {
    // Garante que a empresa existe e o usuário tem permissão antes de atualizar
    await this.getCompanyById(fastify, userId, companyId); // Reutiliza a lógica de busca e permissão

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

  /**
   * Remove uma empresa (soft delete, atualizando o status para 'inactive').
   * @param {import("fastify").FastifyInstance} fastify - Instância do Fastify.
   * @param {number} userId - ID do usuário autenticado.
   * @param {number} companyId - ID da empresa a ser removida.
   * @returns {Promise<object>} Mensagem de sucesso.
   */
  async deleteCompany(fastify, userId, companyId) {
    // Garante que a empresa existe e o usuário tem permissão
    const company = await this.getCompanyById(fastify, userId, companyId);

    if (company.status === "inactive") {
      return { message: "Empresa já está inativa." };
    }

    try {
      await fastify
        .knex("companies")
        .where("id", companyId)
        .update({ status: "inactive", updated_at: fastify.knex.fn.now() }); // [cite: 1] (status field)
      return { message: "Empresa desativada com sucesso." };
    } catch (error) {
      fastify.log.error(error, `Erro ao desativar empresa ID: ${companyId}`);
      throw new Error("Não foi possível desativar a empresa.");
    }
  }

  /**
   * Faz upload do logo de uma empresa para o Cloudinary e atualiza a URL no banco.
   * @param {import("fastify").FastifyInstance} fastify - Instância do Fastify.
   * @param {number} userId - ID do usuário autenticado.
   * @param {number} companyId - ID da empresa.
   * @param {object} fileData - Dados do arquivo do @fastify/multipart (contém stream, filename, mimetype).
   * @returns {Promise<object>} Objeto com mensagem e URL do logo, ou a empresa atualizada.
   */
  async uploadCompanyLogo(fastify, userId, companyId, fileData) {
    // Garante que a empresa existe e o usuário tem permissão
    await this.getCompanyById(fastify, userId, companyId);

    // ---- INÍCIO DA LÓGICA DO CLOUDINARY (EXEMPLO CONCEITUAL) ----
    // Substitua esta seção pela integração real com o SDK do Cloudinary
    // Certifique-se de que o Cloudinary está configurado (veja o construtor)

    // Exemplo de como você usaria o stream com o SDK do Cloudinary:
    /*
    if (!cloudinary.config().cloud_name) {
      fastify.log.error("Cloudinary não configurado para upload de logo.");
      throw new Error("Serviço de upload de imagem não está configurado.");
    }

    const uploadStream = (fileStream) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `company_logos/${companyId}`, public_id: `logo_${Date.now()}` }, // Opcional: organizar em pastas
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
      uploadResult = await uploadStream(fileData.file);
    } catch (error) {
      fastify.log.error(error, "Erro ao fazer upload do logo para o Cloudinary");
      const serviceError = new Error("Falha no upload do logo.");
      serviceError.statusCode = 500; // Internal Server Error or specific Cloudinary error
      throw serviceError;
    }

    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error("Upload para o Cloudinary não retornou uma URL válida.");
    }
    const logoUrl = uploadResult.secure_url;
    */
    // ---- FIM DA LÓGICA DO CLOUDINARY (EXEMPLO CONCEITUAL) ----

    // ----- INÍCIO DO MOCK PARA QUANDO O CLOUDINARY NÃO ESTIVER INTEGRADO -----
    // REMOVA ESTE BLOCO QUANDO O CLOUDINARY ESTIVER FUNCIONANDO
    if (!fastify.config.CLOUDINARY_CLOUD_NAME) {
      // Simula o upload se não estiver configurado
      fastify.log.warn(
        `[MOCK] Simulating Cloudinary upload for company ${companyId}, file: ${fileData.filename}`
      );
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simula delay da rede
      const logoUrl = `https://mock.cloudinary.com/empresor/company_logos/${companyId}/logo_${
        fileData.filename
      }_${Date.now()}.png`;
      fastify.log.info(`[MOCK] Logo URL gerada: ${logoUrl}`);
      try {
        const [updatedCompany] = await fastify
          .knex("companies")
          .where("id", companyId)
          .update({ logo_url: logoUrl, updated_at: fastify.knex.fn.now() }) // [cite: 1]
          .returning(["id", "name", "logo_url"]); // ou "*" para retornar a empresa toda
        return { message: "Logo atualizado (MOCK).", company: updatedCompany };
      } catch (dbError) {
        fastify.log.error(
          dbError,
          `Erro ao atualizar URL do logo (MOCK) para empresa ID: ${companyId}`
        );
        throw new Error(
          "Não foi possível atualizar a URL do logo da empresa (MOCK)."
        );
      }
    }
    // ----- FIM DO MOCK -----

    // Esta parte só deve ser executada se o Cloudinary real for usado e bem-sucedido
    // (Mova para dentro do try/catch do Cloudinary real quando implementado)
    /*
    try {
      const [updatedCompany] = await fastify
        .knex("companies")
        .where("id", companyId)
        .update({ logo_url: logoUrl, updated_at: fastify.knex.fn.now() })
        .returning(["id", "name", "logo_url"]); // ou "*" para retornar a empresa toda
      // return updatedCompany; // Se quiser retornar o objeto empresa completo
      return { message: "Logo atualizado com sucesso.", company: updatedCompany };
    } catch (dbError) {
      fastify.log.error(dbError, `Erro ao atualizar URL do logo para empresa ID: ${companyId}`);
      // Tentar deletar a imagem do Cloudinary se a atualização no DB falhar? (Lógica de rollback)
      throw new Error("Não foi possível atualizar a URL do logo da empresa.");
    }
    */
  }
}

module.exports = new CompanyService();
