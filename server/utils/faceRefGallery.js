/**
 * Galerie des fiches de reference visage generees : chaque fiche produite par
 * /api/generate/face-ref est conservee (Blob, ou disque local en repli) avec une
 * ligne FaceRefSheet, pour la retrouver, la telecharger ou l appliquer plus tard
 * a une persona.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isBlobStorageEnabled, isAbsoluteHttpUrl, uploadPublicMediaBuffer } from './blobStorage.js';
import { deleteMediaByUrl } from './mediaCleanup.js';

const LOCAL_URL_PREFIX = '/uploads/face-ref-gallery/';
const LOCAL_DIR = path.join(process.cwd(), 'public', 'uploads', 'face-ref-gallery');

export const FACE_REF_METHODS = {
  default: 'Méthode standard (3 vues)',
  contact_sheet_9: 'Fiche 9 vues',
  close_up_4: 'Fiche 4 vues gros plan',
};

/** Methode connue, sinon 'default' : la valeur vient du client, jamais stockee telle quelle. */
export function normalizeGalleryMethod(value) {
  const key = String(value || '').trim();
  return Object.prototype.hasOwnProperty.call(FACE_REF_METHODS, key) ? key : 'default';
}

export function describeGalleryMethod(value) {
  return FACE_REF_METHODS[normalizeGalleryMethod(value)];
}

/** Forme renvoyee au navigateur : jamais d autre champ que ceux-ci. */
export function toGalleryEntry(row) {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    method: normalizeGalleryMethod(row.method),
    methodLabel: describeGalleryMethod(row.method),
    profileId: row.profileId || null,
    profileName: row.profile?.name || null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

/** Nom de fichier telecharge : lisible, sans caractere dangereux. */
export function buildDownloadName(entry, extension = 'jpg') {
  const base = String(entry?.profileName || 'fiche').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'fiche';
  const date = String(entry?.createdAt || '').slice(0, 10) || 'sans-date';
  return `fiche-reference-${base}-${date}.${extension}`;
}

/** Stocke le fichier de la fiche : Blob si actif, repli disque local sinon. */
export async function storeGalleryImage(userId, buffer, { extension = 'jpg', mime = 'image/jpeg' } = {}) {
  if (isBlobStorageEnabled()) {
    const uploaded = await uploadPublicMediaBuffer(`face-ref-gallery/${userId}`, extension, buffer, mime);
    return uploaded.url;
  }

  const dir = path.join(LOCAL_DIR, userId);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomBytes(12).toString('hex')}.${extension}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return `${LOCAL_URL_PREFIX}${userId}/${filename}`;
}

/** Supprime le fichier d une fiche (Blob ou disque local). Ne leve jamais. */
export async function deleteGalleryImage(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  if (isAbsoluteHttpUrl(raw)) return deleteMediaByUrl(raw);
  if (!raw.startsWith(LOCAL_URL_PREFIX)) return false;

  const [userId, filename, ...extra] = raw.slice(LOCAL_URL_PREFIX.length).split('/');
  const safe = /^[a-zA-Z0-9._-]+$/;
  if (extra.length || !safe.test(userId || '') || !safe.test(filename || '') || userId.includes('..') || filename.includes('..')) return false;

  try {
    await fs.unlink(path.join(LOCAL_DIR, userId, filename));
    return true;
  } catch {
    return false;
  }
}

/**
 * Enregistre une fiche generee dans la galerie. Ne leve jamais : la generation
 * (deja payee) ne doit pas echouer parce que la galerie n est pas disponible
 * (table absente, stockage en panne) ; l appelant recoit null et la fiche reste
 * utilisable comme avant.
 */
export async function saveGallerySheet(prisma, { userId, profileId = null, buffer, method = 'default' }) {
  // Table/modele absent : inutile (et couteux) de stocker un fichier que rien ne retrouvera.
  if (typeof prisma?.faceRefSheet?.create !== 'function') {
    console.warn('[face-ref-gallery] modele FaceRefSheet indisponible : fiche non conservee');
    return null;
  }
  try {
    const imageUrl = await storeGalleryImage(userId, buffer);
    try {
      const row = await prisma.faceRefSheet.create({
        data: { userId, profileId: profileId || null, imageUrl, method: normalizeGalleryMethod(method) },
        select: { id: true },
      });
      return row.id;
    } catch (error) {
      await deleteGalleryImage(imageUrl);
      throw error;
    }
  } catch (error) {
    console.warn('[face-ref-gallery] fiche non conservee', { name: error?.name, code: error?.code, message: error?.message });
    return null;
  }
}

/** Table absente (migration pas encore appliquee) ou modele inconnu du client Prisma. */
export function isGalleryUnavailable(error) {
  if (error instanceof TypeError) return true;
  if (error?.code === 'P2021' || error?.code === 'P2022') return true;
  const message = String(error?.message || '').toLowerCase();
  return message.includes('does not exist') || message.includes('unknown arg') || message.includes('unknown field');
}
