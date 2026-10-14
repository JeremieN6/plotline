import { loadPersonality } from './facelessStyleStore.js';
import { buildPersonalityBrief } from './personalityBrief.js';
import { getSiteContext } from './siteContext.js';

/**
 * Contexte d une MARQUE donne a Claude (slides, prompts, legendes) : fiche du profil, texte de son site et, si elle
 * existe, la voix de sa personnalite. Seuls les profils de type BRAND en ont un ; tout autre profil renvoie null et
 * le comportement reste celui d avant.
 */

const SELECT = {
  id: true,
  userId: true,
  name: true,
  profileType: true,
  niche: true,
  description: true,
  website: true,
  targetAudience: true,
};

/**
 * @param {object} prisma
 * @param {string} profileId
 * @param {string|null} [userId] si fourni, le profil doit appartenir a ce compte (requetes de l utilisateur) ;
 *   le worker de generation, qui travaille sur un contenu deja verifie, l omet.
 */
export async function loadBrandContext(prisma, profileId, userId = null) {
  const id = String(profileId || '').trim();
  if (!id || !prisma) return null;

  let row;
  try {
    row = await prisma.profile.findFirst({ where: userId ? { id, userId } : { id }, select: SELECT });
  } catch (error) {
    console.warn('[brand] profil de marque illisible, aucun contexte de marque', {
      reason: String(error?.message || error).split('\n')[0].slice(0, 160),
    });
    return null;
  }
  if (!row || row.profileType !== 'BRAND') return null;

  const [siteText, personality] = await Promise.all([
    getSiteContext(row.website),
    loadPersonality(prisma, row.id, row.userId),
  ]);

  return {
    id: row.id,
    name: String(row.name || '').trim(),
    niche: String(row.niche || '').trim(),
    description: String(row.description || '').trim(),
    audience: String(row.targetAudience || '').trim(),
    website: String(row.website || '').trim(),
    siteText,
    voice: buildPersonalityBrief(personality, { maxChars: 1200 }),
  };
}

function clip(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Bloc de texte du contexte de marque pour un prompt systeme (pur) ; '' si pas de contexte. */
export function buildBrandContextBlock(context) {
  if (!context?.name) return '';

  const lines = ['Contexte de la marque (fiche et site de la marque) :'];
  lines.push(`- Nom : ${clip(context.name, 80)}`);
  if (context.niche) lines.push(`- Domaine : ${clip(context.niche, 120)}`);
  if (context.description) lines.push(`- Description : ${clip(context.description, 600)}`);
  if (context.audience) lines.push(`- Public vise : ${clip(context.audience, 200)}`);
  if (context.siteText) lines.push(`- Ce que dit son site (${clip(context.website, 80)}) : ${clip(context.siteText, 1800)}`);
  if (context.voice) lines.push('', clip(context.voice, 1300).replace(/\s*\n\s*/g, '\n'));
  return lines.join('\n');
}
