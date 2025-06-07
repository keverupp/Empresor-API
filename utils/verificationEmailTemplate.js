// src/templates/verificationEmailTemplate.js
"use strict";

/**
 * Gera o HTML para o e-mail de verificação de código da empresa com design moderno.
 * @param {object} options
 * @param {string} options.companyName - Nome da empresa sendo verificada.
 * @param {string} options.verificationCode - O código de 6 dígitos.
 * @param {string} [options.appName='Empresor'] - Nome do aplicativo.
 * @param {string} [options.logoUrl] - URL do logo para o cabeçalho do e-mail.
 * @param {string} [options.primaryColor='#F97316'] - Cor primária para destaques.
 * @param {number} [options.codeExpiryMinutes=15] - Tempo de expiração do código em minutos.
 * @returns {string} HTML completo do e-mail.
 */
function getCompanyVerificationEmailHTML({
  companyName,
  verificationCode,
  appName = "Empresor",
  logoUrl,
  primaryColor = "#F97316",
  codeExpiryMinutes = 15,
}) {
  // Funções auxiliares de cor (para gerar variações da cor primária)
  function darkenColor(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16),
      amt = Math.round(2.55 * percent * 100),
      R = (num >> 16) - amt,
      G = ((num >> 8) & 0x00ff) - amt,
      B = (num & 0x0000ff) - amt;
    return `#${(
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)}`;
  }

  // Paleta de cores dinâmica baseada na cor primária
  const colors = {
    primary: primaryColor,
    primaryDark: darkenColor(primaryColor, 0.1),
    text: { primary: "#1f2937", secondary: "#6b7280", white: "#ffffff" },
    background: { body: "#f8fafc", container: "#ffffff", accent: "#f1f5f9" },
    border: { light: "#e2e8f0", medium: "#cbd5e1" },
  };

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Código de Verificação - ${appName}</title>
    <style>
      body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: ${
        colors.background.body
      }; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; }
      .email-wrapper { width: 100%; background-color: ${
        colors.background.body
      }; padding: 20px 0; }
      .email-container { width: 100%; max-width: 600px; margin: 0 auto; background-color: ${
        colors.background.container
      }; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08); overflow: hidden; border: 1px solid ${
    colors.border.light
  }; }
      .email-header { background: linear-gradient(135deg, ${
        colors.primary
      } 0%, ${
    colors.primaryDark
  } 100%); padding: 40px 30px; text-align: center; }
      .email-header img { max-width: 180px; height: auto; filter: brightness(0) invert(1); }
      .email-header h1 { color: ${
        colors.text.white
      }; font-size: 28px; font-weight: 700; margin: 10px 0 0 0; }
      .email-body { padding: 40px; }
      .greeting { font-size: 24px; font-weight: 600; color: ${
        colors.text.primary
      }; margin: 0 0 24px 0; }
      .email-body p { margin: 0 0 18px 0; font-size: 16px; line-height: 1.7; color: ${
        colors.text.secondary
      }; }
      .code-box { background: ${colors.background.accent}; border: 1px dashed ${
    colors.border.medium
  }; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center; }
      .code-box-title { margin: 0 0 15px 0; font-size: 14px; color: ${
        colors.text.secondary
      }; font-weight: 500; }
      .code { font-family: 'Courier New', monospace; font-size: 38px; font-weight: 700; color: ${
        colors.text.primary
      }; letter-spacing: 10px; margin: 0; padding-left: 10px; }
      .warning-section { border-left: 4px solid #f59e0b; background: #fefce8; border-radius: 8px; padding: 20px; margin: 25px 0; }
      .warning-section p { color: #92400e; margin: 0; font-size: 14px; }
      .email-footer { background: ${
        colors.background.accent
      }; text-align: center; padding: 30px 40px; border-top: 1px solid ${
    colors.border.light
  }; }
      .email-footer p { margin: 0 0 8px 0; font-size: 13px; color: ${
        colors.text.secondary
      }; line-height: 1.5; }
      .email-footer .signature { font-weight: 600; margin-top: 16px; }
      @media (prefers-color-scheme: dark) {
        .email-container { background-color: #1f2937; border-color: #374151; }
        .email-header { background: linear-gradient(135deg, ${
          colors.primary
        } 0%, ${darkenColor(colors.primary, 0.2)} 100%); }
        .greeting, .code, .email-body p, .email-footer p, .email-footer .signature, .code-box-title { color: #d1d5db; }
        .email-body p, .email-footer p { color: #9ca3af; }
        .greeting, .code { color: #f9fafb; }
        .background-body { background-color: #111827; }
        .background-accent { background: #374151; }
        .border-light { border-color: #4b5563; }
        .warning-section { background: #4a2c0d; border-color: #d97706; }
        .warning-section p { color: #fef3c7; }
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="email-container">
        <div class="email-header">
          ${
            logoUrl
              ? `<img src="${logoUrl}" alt="${appName} Logo" />`
              : `<h1>${appName}</h1>`
          }
        </div>
        <div class="email-body">
          <h2 class="greeting">Olá, ${companyName}!</h2>
          <p>Para ativar o cadastro da sua empresa no sistema <strong>${appName}</strong>, por favor, utilize o código de verificação abaixo.</p>
          <div class="code-box">
            <div class="code-box-title">Seu código de verificação é:</div>
            <p class="code">${verificationCode}</p>
          </div>
          <p>Este código é confidencial e expira em <strong>${codeExpiryMinutes} minutos</strong>.</p>
          <div class="warning-section">
            <p>Se você não solicitou esta verificação, pode ignorar este email com segurança. Nenhuma ação será tomada.</p>
          </div>
        </div>
        <div class="email-footer">
          <p class="signature">Atenciosamente,<br><strong>Equipe ${appName}</strong></p>
          <p>&copy; ${new Date().getFullYear()} ${appName}. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

module.exports = {
  getCompanyVerificationEmailHTML,
};
