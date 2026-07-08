import { createError } from 'h3';
import { prisma } from '../../../utils/prisma.js';
import {
  createOpaqueToken,
  hashOpaqueToken,
  normalizeEmail,
  requireAuthUser,
  verifyPassword,
} from '../../../utils/auth.js';
import { sendMail } from '../../../utils/mailer.js';
import { buildEmailChangeEmail } from '../../../utils/authEmails.js';

const EMAIL_CHANGE_TOKEN_TTL_MS = 60 * 60 * 1000;

function resolveSecret(event) {
  const config = useRuntimeConfig(event);
  return String(config.authSessionSecret || config.geminiApiKey || 'plotline-dev-session-secret');
}

function resolveBaseUrl(event) {
  const config = useRuntimeConfig(event);
  return String(config.public?.baseUrl || config.baseUrl || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event);
  const body = await readBody(event);

  const newEmail = normalizeEmail(body?.newEmail);
  const password = String(body?.password || '');

  if (!newEmail || !newEmail.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Nouvel email invalide' });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!currentUser?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Session invalide' });
  }

  if (newEmail === currentUser.email) {
    throw createError({ statusCode: 400, statusMessage: 'Le nouvel email est identique a l email actuel' });
  }

  if (currentUser.passwordHash) {
    const passwordOk = await verifyPassword(password, currentUser.passwordHash);
    if (!passwordOk) {
      throw createError({ statusCode: 401, statusMessage: 'Mot de passe incorrect' });
    }
  }

  const emailAlreadyUsed = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });

  if (emailAlreadyUsed?.id) {
    throw createError({ statusCode: 409, statusMessage: 'Cette adresse email est deja utilisee' });
  }

  const rawToken = createOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken, resolveSecret(event));
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TOKEN_TTL_MS);

  await prisma.emailChangeToken.deleteMany({ where: { userId: currentUser.id } });
  await prisma.emailChangeToken.create({
    data: {
      userId: currentUser.id,
      newEmail,
      tokenHash,
      expiresAt,
    },
  });

  const confirmUrl = `${resolveBaseUrl(event)}/auth/confirm-email-change?token=${encodeURIComponent(rawToken)}`;
  const emailTemplate = buildEmailChangeEmail({ confirmUrl, newEmail });

  try {
    await sendMail({
      to: newEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });
  } catch (err) {
    console.error('[auth:email:change] mail send failure', err);
    throw createError({ statusCode: 500, statusMessage: 'Impossible d envoyer le mail de confirmation' });
  }

  return { ok: true };
});
