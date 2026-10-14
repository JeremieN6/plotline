import { FACELESS_DURATIONS, MAX_SOURCE_TEXT, normalizeFacelessDuration, normalizeSourceText } from './facelessPlanGenerator.js';

/** Longueur maximale de la consigne (angle, ton) qui accompagne le texte source. */
export const EXTERNAL_MAX_IDEA = 2000;

/**
 * Pur : valide et normalise le corps d un appel service-a-service qui demande une video
 * faceless a partir d un texte (article de blog). Renvoie { error } (message court, code 400)
 * ou { value }. Le texte n est JAMAIS coupe en silence : trop long = refus.
 */
export function parseExternalFacelessBody(body) {
  const profileId = String(body?.profileId || '').trim();
  if (!profileId) return { error: 'profileId requis' };

  const sourceText = normalizeSourceText(body?.sourceText);
  if (!sourceText) return { error: 'sourceText requis' };
  if (sourceText.length > MAX_SOURCE_TEXT) {
    return { error: `sourceText trop long (${MAX_SOURCE_TEXT} caracteres maximum, ${sourceText.length} recus)` };
  }

  const idea = String(body?.idea || '').trim();
  if (idea.length > EXTERNAL_MAX_IDEA) return { error: `idea trop longue (${EXTERNAL_MAX_IDEA} caracteres maximum)` };

  const rawDuration = body?.durationSeconds;
  if (rawDuration !== undefined && rawDuration !== null && rawDuration !== '' && !FACELESS_DURATIONS.includes(Number(rawDuration))) {
    return { error: `durationSeconds invalide (${FACELESS_DURATIONS.join(', ')})` };
  }

  return {
    value: {
      profileId,
      sourceText,
      idea,
      targetSeconds: normalizeFacelessDuration(rawDuration),
      slug: String(body?.slug || '').trim().slice(0, 200),
      sourceProject: String(body?.sourceProject || '').trim().slice(0, 100),
    },
  };
}
