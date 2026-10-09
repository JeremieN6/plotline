import { estimatePackCostUsd, findCatalogEntry } from '../data/facelessAvatarCatalog.js';

/**
 * Pack d avatars d une persona : image de base, puis une image par entree du
 * catalogue generee A PARTIR de cette base (meme personnage, autre expression),
 * sur fond vert detoure par code. Chaque image est un appel PAYANT du modele
 * d image : aucune generation sans confirmation explicite cote API.
 */

export const MAX_PACK_ENTRIES = 32;
export const PACK_STALE_MS = 20 * 60 * 1000;
const CONCURRENCY = 2;

const GREEN_RULES = 'Flat solid pure green background (#00FF00), no shadow, no floor, no text, no border, no other characters, no green anywhere on the character. Square image.';

/** Pur : consigne de l image de base (a partir de la fiche de reference de la persona). */
export function buildBaseAvatarPrompt(avatarPrompt) {
  return [
    'Create ONE stylized avatar character based on the person in the attached reference image: keep the recognizable features (hair, face shape, skin tone, glasses, piercings, signature accessories).',
    `Art direction: ${avatarPrompt || 'chibi sticker style, big head, flat colors, clean outline'}.`,
    'Show the character from the head to the waist, facing the camera, friendly neutral expression, simple everyday outfit.',
    GREEN_RULES,
  ].join(' ');
}

/** Pur : consigne d une entree du pack (meme personnage que l image de reference jointe). */
export function buildEntryPrompt(entry, avatarPrompt) {
  return [
    'Draw the SAME character as the attached reference image: identical face, hair, skin tone, outfit, accessories, colors and art style',
    `(${avatarPrompt || 'chibi sticker style, big head, flat colors, clean outline'}).`,
    `Pose and expression: ${entry.prompt}.`,
    entry.mode === 'head' ? 'Show only the head and neck, centered.' : 'Show the character from the head to the waist or lower, centered.',
    GREEN_RULES,
  ].join(' ');
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Pur : detoure le fond vert d un buffer RGBA (modifie en place). Plus un pixel
 * est "vert" (vert dominant sur rouge et bleu), plus il devient transparent ;
 * les pixels de bord perdent leur dominante verte (despill).
 */
export function keyOutGreen(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const other = Math.max(r, b);
    const spill = g - other;
    if (spill <= 22) continue;

    const alpha = 1 - clamp01((spill - 22) / 70);
    data[i + 3] = Math.round(data[i + 3] * alpha);
    if (alpha < 1) data[i + 1] = other;
  }
  return data;
}

/** Pur : boite englobante des pixels visibles, ou null si l image est vide. */
export function visibleBounds(data, width, height, threshold = 16) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Image du modele (fond vert) -> PNG transparent, rogne au personnage et
 * ramene a 900 px maximum. Leve une erreur si rien ne reste (fond vert seul).
 */
export async function keyAndTrimPng(imageBuffer) {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  keyOutGreen(data);

  const bounds = visibleBounds(data, info.width, info.height);
  if (!bounds || bounds.width < 24 || bounds.height < 24) throw new Error('Aucun personnage detecte apres detourage');

  const pad = 8;
  const left = Math.max(0, bounds.left - pad);
  const top = Math.max(0, bounds.top - pad);
  const width = Math.min(info.width - left, bounds.width + pad * 2);
  const height = Math.min(info.height - top, bounds.height + pad * 2);

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left, top, width, height })
    .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}

/** Pur : tarif indicatif pour l interface. */
export function describePackCost(count) {
  return { count, usd: estimatePackCostUsd(count) };
}

/** Pur : valide la liste d id demandes. */
export function validatePackIds(ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map((id) => String(id)))];
  if (!list.length) throw new Error('Aucune image demandee');
  if (list.length > MAX_PACK_ENTRIES) throw new Error(`Au plus ${MAX_PACK_ENTRIES} images`);
  const unknown = list.filter((id) => !findCatalogEntry(id));
  if (unknown.length) throw new Error(`Images inconnues : ${unknown.join(', ')}`);
  return list;
}

/** Pur : une generation du pack est-elle deja en cours (et pas abandonnee) ? */
export function isPackBusy(pack, now = Date.now()) {
  return Boolean(pack?.generating) && now - (pack?.startedAt || 0) < PACK_STALE_MS;
}

function imagePart(buffer, mimeType = 'image/png') {
  return { inlineData: { mimeType, data: buffer.toString('base64') } };
}

/**
 * Genere UNE image du pack. `deps` (injectables) : generate(prompt, parts) ->
 * { data (base64), mimeType }, save(buffer, { extension, contentType }) -> url.
 */
export async function generatePackEntry({ baseBuffer, entry, avatarPrompt, deps }) {
  const inline = await deps.generate(buildEntryPrompt(entry, avatarPrompt), [imagePart(baseBuffer)]);
  const raw = Buffer.from(String(inline?.data || ''), 'base64');
  if (!raw.length) throw new Error('Le modele n a renvoye aucune image');
  const png = await keyAndTrimPng(raw);
  return deps.save(png, { extension: 'png', contentType: 'image/png' });
}

/** Genere l image de base a partir de la fiche de reference. Renvoie l URL (fond vert conserve). */
export async function generateBaseAvatar({ referenceBuffer, referenceMime, avatarPrompt, deps }) {
  const inline = await deps.generate(buildBaseAvatarPrompt(avatarPrompt), [imagePart(referenceBuffer, referenceMime || 'image/jpeg')]);
  const raw = Buffer.from(String(inline?.data || ''), 'base64');
  if (!raw.length) throw new Error('Le modele n a renvoye aucune image');
  return deps.save(raw, { extension: inline?.mimeType === 'image/png' ? 'png' : 'jpg', contentType: inline?.mimeType || 'image/jpeg' });
}

/**
 * Lance la generation (en tache de fond) des images `ids`. Marque d abord les
 * entrees "pending" puis les met a jour une a une : la page voit l avancement
 * et une image deja prete n est jamais perdue si une autre echoue.
 *
 * `store.update(mutator)` : modifie la DA stockee de facon sure.
 * Renvoie tout de suite { started, count }.
 */
export async function startPackJob({ ids, store, baseUrl, avatarPrompt, deps }) {
  const list = validatePackIds(ids);

  await store.update((style) => {
    const pack = style.avatar.pack || { baseUrl, baseSource: 'generated', entries: {} };
    if (isPackBusy(pack)) throw Object.assign(new Error('Une generation est deja en cours'), { statusCode: 409 });
    pack.baseUrl = pack.baseUrl || baseUrl;
    pack.generating = true;
    pack.startedAt = Date.now();
    for (const id of list) {
      pack.entries[id] = { status: 'pending', mode: findCatalogEntry(id).mode, url: pack.entries[id]?.url || '', error: '' };
    }
    style.avatar.pack = pack;
    return style;
  });

  (async () => {
    try {
      const baseBuffer = await deps.read(baseUrl);
      let next = 0;
      const worker = async () => {
        while (next < list.length) {
          const id = list[next];
          next += 1;
          const entry = findCatalogEntry(id);
          let result;
          try {
            result = { status: 'done', url: await generatePackEntry({ baseBuffer, entry, avatarPrompt, deps }), error: '' };
          } catch (error) {
            console.warn(`[faceless-avatar] image ${id} en echec : ${error?.message || error}`);
            result = { status: 'failed', url: '', error: String(error?.message || error).slice(0, 200) };
          }
          await store.update((style) => {
            const previous = style.avatar.pack.entries[id] || {};
            style.avatar.pack.entries[id] = { ...previous, ...result, url: result.url || previous.url || '', mode: entry.mode };
            return style;
          }).catch((error) => console.warn(`[faceless-avatar] ecriture impossible : ${error?.message || error}`));
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
    } catch (error) {
      console.warn(`[faceless-avatar] generation interrompue : ${error?.message || error}`);
      await store.update((style) => {
        for (const id of list) {
          const e = style.avatar.pack?.entries?.[id];
          if (e?.status === 'pending') style.avatar.pack.entries[id] = { ...e, status: 'failed', error: String(error?.message || error).slice(0, 200) };
        }
        return style;
      }).catch(() => {});
    } finally {
      await store.update((style) => {
        if (style.avatar.pack) style.avatar.pack.generating = false;
        return style;
      }).catch(() => {});
    }
  })();

  return { started: true, count: list.length, ...describePackCost(list.length) };
}

