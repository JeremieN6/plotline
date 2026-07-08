import { createError } from 'h3';
import { prisma } from '../../../utils/prisma.js';
import { createOpaqueToken, hashOpaqueToken, normalizeEmail } from '../../../utils/auth.js';
import { sendMail } from '../../../utils/mailer.js';
import { buildPasswordResetEmail } from '../../../utils/authEmails.js';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function resolveSecret(event) {
  const config = useRuntimeConfig(event);
  return String(config.authSessionSecret || config.geminiApiKey || 'plotline-dev-session-secret');
}

function resolveBaseUrl(event) {
  const config = useRuntimeConfig(event);
  return String(config.public?.baseUrl || config.baseUrl || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const email = normalizeEmail(body?.email);

  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Email invalide' });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  // Ne pas révéler si l'email existe ou non.
  if (!user?.id) {
    return { ok: true };
  }

  const rawToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken, resolveSecret(event));
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetUrl = `${resolveBaseUrl(event)}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
  const emailTemplate = buildPasswordResetEmail({ resetUrl });

  try {
    await sendMail({
      to: user.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });
  } catch (err) {
    console.error('[auth:password:forgot] mail send failure', err);
    throw createError({ statusCode: 500, statusMessage: 'Impossible d envoyer le mail de reinitialisation' });
  }

  return { ok: true };
});
