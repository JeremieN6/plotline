let transportPromise;

function resolveSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || '').trim() || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    from,
  };
}

async function getTransport() {
  if (transportPromise) return transportPromise;

  transportPromise = (async () => {
    const config = resolveSmtpConfig();
    if (!config) {
      return null;
    }

    const nodemailerModule = await import('nodemailer');
    return nodemailerModule.default.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  })();

  return transportPromise;
}

export async function sendMail({ to, subject, html, text }) {
  const config = resolveSmtpConfig();
  if (!config) {
    throw new Error('SMTP config is missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.');
  }

  const transport = await getTransport();
  if (!transport) {
    throw new Error('Unable to initialize SMTP transport.');
  }

  await transport.sendMail({
    from: config.from,
    to,
    subject,
    html,
    text,
  });
}
