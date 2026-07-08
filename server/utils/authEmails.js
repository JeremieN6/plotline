function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLayout({ title, subtitle, ctaLabel, ctaUrl, helperText, badge = 'Plotline Studio' }) {
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const safeCtaLabel = escapeHtml(ctaLabel);
  const safeCtaUrl = escapeHtml(ctaUrl);
  const safeHelperText = escapeHtml(helperText);
  const safeBadge = escapeHtml(badge);

  return `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#0f0905;font-family:'Segoe UI',Arial,sans-serif;color:#ffe9d8;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:radial-gradient(circle at 15% 10%, rgba(245,173,104,0.26), transparent 34%), radial-gradient(circle at 85% 0%, rgba(230,142,64,0.30), transparent 36%), linear-gradient(155deg,#1b130d 0%,#100a06 58%,#070503 100%);padding:26px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border:1px solid rgba(252,214,170,0.34);border-radius:24px;background:rgba(23,15,9,0.92);padding:30px;">
            <tr>
              <td>
                <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#f8b989;font-weight:700;">${safeBadge}</div>
                <h1 style="margin:12px 0 8px 0;font-size:30px;line-height:1.12;color:#fff3e7;">${safeTitle}</h1>
                <p style="margin:0 0 22px 0;color:#f7d9bf;font-size:15px;line-height:1.55;">${safeSubtitle}</p>

                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px 0;">
                  <tr>
                    <td style="border-radius:12px;background:linear-gradient(92deg,#eb8a40,#d8722e);">
                      <a href="${safeCtaUrl}" style="display:inline-block;padding:12px 18px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">
                        ${safeCtaLabel}
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0;color:#c9a98d;font-size:12px;line-height:1.5;">${safeHelperText}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildPasswordResetEmail({ resetUrl }) {
  const html = buildLayout({
    title: 'Réinitialise ton mot de passe',
    subtitle: 'Une demande de réinitialisation vient d\'être faite pour ton compte Plotline. Clique ci-dessous pour choisir un nouveau mot de passe.',
    ctaLabel: 'Choisir un nouveau mot de passe',
    ctaUrl: resetUrl,
    helperText: `Ce lien expire dans 60 minutes. Si tu n\'es pas à l\'origine de cette demande, ignore simplement cet email. Lien direct: ${resetUrl}`,
  });

  const text = [
    'Plotline Studio',
    '',
    'Réinitialisation du mot de passe',
    'Une demande de réinitialisation a été faite pour ton compte.',
    `Lien: ${resetUrl}`,
    'Ce lien expire dans 60 minutes.',
    'Si ce n\'est pas toi, ignore cet email.',
  ].join('\n');

  return {
    subject: 'Plotline | Réinitialisation du mot de passe',
    html,
    text,
  };
}

export function buildEmailChangeEmail({ confirmUrl, newEmail }) {
  const html = buildLayout({
    title: 'Confirme ta nouvelle adresse',
    subtitle: `Tu as demandé à remplacer ton email de connexion par ${newEmail}. Confirme la nouvelle adresse pour finaliser le changement.`,
    ctaLabel: 'Confirmer la nouvelle adresse',
    ctaUrl: confirmUrl,
    helperText: `Ce lien expire dans 60 minutes. Si tu n\'as pas demandé ce changement, ignore cet email. Lien direct: ${confirmUrl}`,
  });

  const text = [
    'Plotline Studio',
    '',
    'Confirmation de changement d\'adresse email',
    `Nouvelle adresse demandée: ${newEmail}`,
    `Lien de confirmation: ${confirmUrl}`,
    'Ce lien expire dans 60 minutes.',
    'Si ce n\'est pas toi, ignore cet email.',
  ].join('\n');

  return {
    subject: 'Plotline | Confirmation de nouvelle adresse email',
    html,
    text,
  };
}
