import crypto from 'node:crypto';

import { runScheduledPublications } from '../../utils/scheduledPublisher.js';

/**
 * Declenchement d un passage du publicateur planifie depuis un cron externe
 * (cron du VPS, appel programme). Alternative au plugin Nitro pour qui prefere
 * piloter la cadence depuis l hote plutot que depuis le process applicatif.
 */

function timingSafeEquals(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');

  if (left.length !== right.length || !left.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export default defineEventHandler(async (event) => {
  const expectedSecret = String(process.env.SCHEDULER_TRIGGER_SECRET || '').trim();

  // Sans secret configure, la route reste fermee: elle declenche des
  // publications reelles et ne doit jamais etre joignable par defaut.
  if (!expectedSecret) {
    return sendError(event, createError({
      statusCode: 404,
      statusMessage: 'Route indisponible',
    }));
  }

  const providedSecret = getHeader(event, 'x-scheduler-secret');
  if (!timingSafeEquals(providedSecret, expectedSecret)) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Secret invalide' }));
  }

  const { prisma } = await import('../../utils/prisma.js');
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  const summary = await runScheduledPublications({ prisma, baseUrl });

  return {
    success: !summary.error,
    ...summary,
  };
});
