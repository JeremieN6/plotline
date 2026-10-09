import { randomBytes } from 'node:crypto';

import { ILLUSTRATION_KINDS, MAX_ILLUSTRATION_PROMPT } from '../data/facelessIllustrations.js';
import { IMAGE_COST_USD } from '../data/facelessAvatarCatalog.js';

/**
 * Illustrations d un dossier faceless : prompts, nettoyage de l image, entrees.
 * Chaque generation est un appel PAYANT du modele d image (meme tarif que le
 * pack d avatars) ; l import d une photo est gratuit.
 */

const NO_FACE = 'No visible face anywhere (show hands, objects, scenery, a person from behind or cropped below the chin at most).';
const NO_TEXT = 'No readable text, no logos, no brand names, no watermark.';

function paletteLine(style) {
  const p = style?.palette;
  return p ? `Color palette to echo: ${p.background}, ${p.accent}, ${p.accent2}, ${p.text}.` : '';
}

/** Pur : consigne de generation selon le type d illustration. */
export function buildIllustrationPrompt({ kind, prompt, style = null, persona = null }) {
  const subject = String(prompt || '').trim().slice(0, MAX_ILLUSTRATION_PROMPT);
  const context = persona
    ? `Context: the images belong to a ${persona.gender === 'MALE' ? 'male' : 'female'} content creator${persona.niche ? ` in the niche "${persona.niche}"` : ''}; it should feel like their everyday life.`
    : '';

  if (kind === 'illustration') {
    return [
      'Create ONE flat illustration with a clean, simple composition and soft shadows.',
      `Subject: ${subject}.`,
      `Art direction: ${style?.avatarPrompt || 'flat colors, clean outline, friendly shapes'}.`,
      paletteLine(style),
      NO_FACE,
      NO_TEXT,
      'Vertical 4:5 composition, subject centered with some margin.',
    ].filter(Boolean).join(' ');
  }

  if (kind === 'mockup') {
    return [
      'Create ONE clean screenshot-style mockup of a generic app or website screen, shown straight on, with an invented interface (no real product).',
      `The screen is about: ${subject}.`,
      paletteLine(style),
      'Use simple blocks, icons and large shapes instead of small text; keep any text to a few large generic words.',
      'No real brand logos, no watermark. Vertical 4:5 composition.',
    ].filter(Boolean).join(' ');
  }

  return [
    'Create ONE realistic candid smartphone photo: natural light, slightly imperfect framing, authentic social media feel, shallow depth of field.',
    `Subject: ${subject}.`,
    context,
    NO_FACE,
    NO_TEXT,
    'Vertical 4:5 composition.',
  ].filter(Boolean).join(' ');
}

/** Pur : identifiant d une nouvelle illustration. */
export function newIllustrationId() {
  return `ill-${randomBytes(5).toString('hex')}`;
}

/** Pur : libelle court tire de la description (ou du nom du fichier). */
export function illustrationLabel(label, prompt) {
  const text = String(label || prompt || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 80) || 'Illustration';
}

/**
 * Image -> JPEG propre : orientation EXIF appliquee puis metadonnees retirees
 * (position GPS, appareil...), 1200 x 1500 au plus. Sert aux photos importees
 * ET aux images generees.
 */
export async function processIllustrationImage(buffer) {
  const sharp = (await import('sharp')).default;
  return sharp(buffer)
    .rotate()
    .resize({ width: 1200, height: 1500, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 86 })
    .toBuffer();
}

/** Pur : cout indicatif de n illustrations generees. */
export function describeIllustrationCost(count) {
  return { count, usd: Math.round(Math.max(0, count) * IMAGE_COST_USD * 100) / 100 };
}

/**
 * Genere UNE illustration. `deps` (injectables) : generate(prompt) ->
 * { data (base64) }, save(buffer, { extension, contentType }) -> url.
 * @returns {Promise<{ id, kind, label, prompt, url, source, createdAt }>}
 */
export async function generateIllustration({ kind, prompt, label, style, persona, deps }) {
  const safeKind = Object.hasOwn(ILLUSTRATION_KINDS, kind) ? kind : 'photo';
  const text = String(prompt || '').trim().slice(0, MAX_ILLUSTRATION_PROMPT);
  if (!text) throw new Error('Description de l illustration vide');

  const inline = await deps.generate(buildIllustrationPrompt({ kind: safeKind, prompt: text, style, persona }));
  const raw = Buffer.from(String(inline?.data || ''), 'base64');
  if (!raw.length) throw new Error('Le modele n a renvoye aucune image');

  const jpeg = await processIllustrationImage(raw);
  const url = await deps.save(jpeg, { extension: 'jpg', contentType: 'image/jpeg' });
  return { id: newIllustrationId(), kind: safeKind, label: illustrationLabel(label, text), prompt: text, url, source: 'generated', createdAt: Date.now() };
}

/** Importe une photo (gratuit) : meme nettoyage, meme forme d entree. */
export async function importIllustration({ buffer, kind, label, deps }) {
  const jpeg = await processIllustrationImage(buffer);
  const url = await deps.save(jpeg, { extension: 'jpg', contentType: 'image/jpeg' });
  return {
    id: newIllustrationId(),
    kind: Object.hasOwn(ILLUSTRATION_KINDS, kind) ? kind : 'photo',
    label: illustrationLabel(label, ''),
    prompt: '',
    url,
    source: 'upload',
    createdAt: Date.now(),
  };
}

/** Dossier de stockage (Blob ou disque) des fichiers d un dossier faceless. */
export function facelessAssetFolder(profileId, section) {
  return `faceless-assets/${profileId}/${section}`;
}
