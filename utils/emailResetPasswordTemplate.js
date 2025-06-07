// utils/emailTemplates.js ou para ser adicionado/importado em authService.js

/**
 * Gera o HTML para o e-mail de redefinição de senha com design moderno e responsivo.
 * @param {object} options
 * @param {string} options.userName - Nome do usuário.
 * @param {string} options.resetLink - Link completo para redefinição de senha.
 * @param {string} [options.appName='Empresor'] - Nome do aplicativo.
 * @param {string} [options.logoUrl] - URL do logo da empresa/aplicativo.
 * @param {string} [options.primaryColor='#F97316'] - Cor primária para o botão e destaques.
 * @param {number} [options.tokenExpiryMinutes=60] - Tempo de expiração do token em minutos.
 * @returns {string} HTML do e-mail.
 */
function getPasswordResetEmailHTML({
  userName,
  resetLink,
  appName = "Empresor",
  logoUrl,
  primaryColor = "#F97316",
  tokenExpiryMinutes = 60,
}) {
  // Paleta de cores aprimorada
  const colors = {
    primary: primaryColor,
    primaryDark: darkenColor(primaryColor, 0.1),
    primaryLight: lightenColor(primaryColor, 0.9),
    text: {
      primary: "#1f2937",
      secondary: "#6b7280",
      muted: "#9ca3af",
      white: "#ffffff",
    },
    background: {
      body: "#f8fafc",
      container: "#ffffff",
      accent: "#f1f5f9",
      warning: "#fef3c7",
    },
    border: {
      light: "#e2e8f0",
      medium: "#cbd5e1",
    },
  };

  // Função auxiliar para escurecer cor
  function darkenColor(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent * 100);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return (
      "#" +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  // Função auxiliar para clarear cor
  function lightenColor(hex, percent) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent * 100);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      "#" +
      (
        0x1000000 +
        (R > 255 ? 255 : R) * 0x10000 +
        (G > 255 ? 255 : G) * 0x100 +
        (B > 255 ? 255 : B)
      )
        .toString(16)
        .slice(1)
    );
  }

  return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Redefinição de Senha - ${appName}</title>
        <!--[if mso]>
        <noscript>
          <xml>
            <o:OfficeDocumentSettings>
              <o:AllowPNG/>
              <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
          </xml>
        </noscript>
        <![endif]-->
        <style>
          /* Reset e base */
          * { box-sizing: border-box; }
          body { 
            margin: 0; 
            padding: 0; 
            width: 100% !important; 
            -webkit-text-size-adjust: 100%; 
            -ms-text-size-adjust: 100%; 
            background-color: ${colors.background.body};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          }
          
          /* Container principal */
          .email-wrapper {
            width: 100%;
            background-color: ${colors.background.body};
            padding: 20px 0;
          }
          
          .email-container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: ${colors.background.container};
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.03);
            overflow: hidden;
            border: 1px solid ${colors.border.light};
          }
          
          /* Header com gradiente sutil */
          .email-header {
            background: linear-gradient(135deg, ${colors.primary} 0%, ${
    colors.primaryDark
  } 100%);
            padding: 40px 30px 30px;
            text-align: center;
            position: relative;
          }
          
          .email-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.05"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            pointer-events: none;
          }
          
          .email-header .logo-container {
            position: relative;
            z-index: 1;
          }
          
          .email-header img {
            max-width: 200px;
            height: auto;
            filter: brightness(0) invert(1);
          }
          
          .email-header h1 {
            color: ${colors.text.white};
            font-size: 32px;
            font-weight: 700;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            letter-spacing: -0.5px;
          }
          
          /* Ícone de segurança */
          .security-icon {
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 50%;
            margin: 20px auto 0;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
          }
          
          /* Corpo do email */
          .email-body {
            padding: 40px 40px 30px;
          }
          
          .greeting {
            font-size: 24px;
            font-weight: 600;
            color: ${colors.text.primary};
            margin: 0 0 24px 0;
            letter-spacing: -0.3px;
          }
          
          .email-body p {
            margin: 0 0 18px 0;
            font-size: 16px;
            line-height: 1.7;
            color: ${colors.text.secondary};
          }
          
          .highlight-box {
            background: ${colors.primaryLight};
            border: 1px solid ${colors.border.light};
            border-radius: 12px;
            padding: 24px;
            margin: 30px 0;
            text-align: center;
          }
          
          /* Botão principal aprimorado */
          .button-container {
            text-align: center;
            margin: 35px 0;
          }
          
          .button {
            background: linear-gradient(135deg, ${colors.primary} 0%, ${
    colors.primaryDark
  } 100%);
            color: ${colors.text.white} !important;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            display: inline-block;
            font-size: 16px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            text-transform: none;
            letter-spacing: 0.2px;
            border: none;
            min-width: 200px;
          }
          
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
          }
          
          /* Link alternativo */
          .link-section {
            background: ${colors.background.accent};
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
          }
          
          .link-section h4 {
            margin: 0 0 12px 0;
            color: ${colors.text.primary};
            font-size: 14px;
            font-weight: 600;
          }
          
          .link-text {
            font-size: 13px;
            color: ${colors.text.muted};
            word-break: break-all;
            line-height: 1.5;
            background: ${colors.background.container};
            padding: 12px;
            border-radius: 6px;
            border: 1px solid ${colors.border.light};
            font-family: 'Courier New', monospace;
          }
          
          /* Seção de aviso */
          .warning-section {
            background: ${colors.background.warning};
            border-left: 4px solid #f59e0b;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
          }
          
          .warning-section .warning-title {
            font-weight: 600;
            color: #92400e;
            margin: 0 0 8px 0;
            font-size: 14px;
          }
          
          .warning-section p {
            color: #92400e;
            margin: 0;
            font-size: 14px;
          }
          
          /* Footer aprimorado */
          .email-footer {
            background: ${colors.background.accent};
            text-align: center;
            padding: 30px 40px;
            border-top: 1px solid ${colors.border.light};
          }
          
          .email-footer p {
            margin: 0 0 8px 0;
            font-size: 13px;
            color: ${colors.text.muted};
            line-height: 1.5;
          }
          
          .email-footer .signature {
            font-weight: 600;
            color: ${colors.text.secondary};
            margin-top: 16px;
          }
          
          /* Responsividade */
          @media only screen and (max-width: 600px) {
            .email-container {
              margin: 10px;
              border-radius: 12px;
            }
            
            .email-header {
              padding: 30px 20px 25px;
            }
            
            .email-header h1 {
              font-size: 26px;
            }
            
            .email-body {
              padding: 30px 25px;
            }
            
            .greeting {
              font-size: 20px;
            }
            
            .button {
              width: 100%;
              padding: 18px 20px;
            }
            
            .email-footer {
              padding: 25px 20px;
            }
          }
          
          @media only screen and (max-width: 480px) {
            .email-wrapper {
              padding: 10px 0;
            }
            
            .email-container {
              margin: 5px;
            }
          }
          
          /* Dark mode support */
          @media (prefers-color-scheme: dark) {
            .email-container {
              background-color: #1f2937;
            }
            
            .email-body {
              color: #e5e7eb;
            }
            
            .greeting {
              color: #f9fafb;
            }
            
            .email-body p {
              color: #d1d5db;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center" valign="top">
                <div class="email-container">
                  
                  <!-- Header -->
                  <div class="email-header">
                    <div class="logo-container">
                      ${
                        logoUrl
                          ? `<img src="${logoUrl}" alt="${appName} Logo" />`
                          : `<h1>${appName}</h1>`
                      }
                    </div>
                    <div class="security-icon">
                      <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zM12 7c1.1 0 2 .9 2 2v2h1v5H9v-5h1V9c0-1.1.9-2 2-2zm0 1c-.55 0-1 .45-1 1v2h2V9c0-.55-.45-1-1-1z"/>
                      </svg>
                    </div>
                  </div>
                  
                  <!-- Corpo -->
                  <div class="email-body">
                    <h2 class="greeting">Olá, ${userName}! 👋</h2>
                    
                    <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>${appName}</strong>. Se você fez essa solicitação, você está no lugar certo!</p>
                    
                    <div class="highlight-box">
                      <p style="margin: 0; font-weight: 600; color: ${
                        colors.text.primary
                      };">
                        Para sua segurança, criamos um link especial que expira em ${tokenExpiryMinutes} minutos.
                      </p>
                    </div>
                    
                    <p>Clique no botão abaixo para criar sua nova senha de forma segura:</p>
                    
                    <div class="button-container">
                      <a href="${resetLink}" target="_blank" class="button" style="color: ${
    colors.text.white
  } !important;">
                        🔐 Redefinir Minha Senha
                      </a>
                    </div>
                    
                    <div class="link-section">
                      <h4>Link não funcionou?</h4>
                      <p style="margin: 0 0 10px 0; font-size: 14px;">Copie e cole este endereço no seu navegador:</p>
                      <div class="link-text">${resetLink}</div>
                    </div>
                    
                    <div class="warning-section">
                      <div class="warning-title">⚠️ Importante</div>
                      <p>Se você <strong>não solicitou</strong> esta alteração, pode ignorar este email com segurança. Sua senha atual permanecerá inalterada.</p>
                    </div>
                    
                    <p>Dúvidas? Nossa equipe de suporte está sempre disponível para ajudar!</p>
                  </div>
                  
                  <!-- Footer -->
                  <div class="email-footer">
                    <p class="signature">Atenciosamente,<br><strong>Equipe ${appName}</strong></p>
                    <p>&copy; ${new Date().getFullYear()} ${appName}. Todos os direitos reservados.</p>
                    <p>Este é um email automático, por favor não responda diretamente.</p>
                  </div>
                  
                </div>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;
}

module.exports = { getPasswordResetEmailHTML };
