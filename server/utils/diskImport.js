// Reception d un fichier importe quand les medias sont sur le disque : ecrit au fil de l eau (une video de 150 Mo
// ne passe jamais entierement en memoire), taille bornee, type REEL verifie sur les premiers octets.
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { diskTarget } from './diskStorage.js';
import { importKindOf, importPathPrefix, safeImportName } from './contentImport.js';

const EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/** Pur : type reel d apres la signature du fichier ('video/mp4' couvre aussi MOV : meme conteneur), ou ''. */
export function detectImportType(head) {
  const bytes = Buffer.from(head || []);
  const ascii = (from, to) => bytes.subarray(from, to).toString('latin1');
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 4 && bytes.readUInt32BE(0) === 0x1a45dfa3) return 'video/webm';
  if (['ftyp', 'moov', 'mdat', 'wide', 'free'].includes(ascii(4, 8))) return 'video/mp4';
  return '';
}

/** Pur : le contenu correspond-il au type annonce ? */
export function typeMatches(declared, detected) {
  if (!detected) return false;
  if (declared === 'video/quicktime') return detected === 'video/mp4';
  return declared === detected;
}

/** Pur : chemin d un fichier importe, toujours dans le dossier du compte. */
export function importPathname(userId, name, contentType, suffix = randomBytes(6).toString('hex')) {
  const stem = safeImportName(name).replace(/\.[^.]*$/, '').replace(/\./g, '-').replace(/^-+|-+$/g, '').slice(-60) || 'fichier';
  return `${importPathPrefix(userId)}${stem}-${suffix}.${EXTENSION_BY_TYPE[contentType]}`;
}

function limiter(maxBytes) {
  let total = 0;
  return new Transform({
    transform(chunk, encoding, callback) {
      total += chunk.length;
      if (total > maxBytes) callback(Object.assign(new Error('Fichier trop lourd.'), { statusCode: 413 }));
      else callback(null, chunk);
    },
  });
}

const refuse = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

/** Enregistre le flux d un fichier importe ; renvoie son adresse publique. Rien ne reste sur le disque en cas de refus. */
export async function receiveImportFile({ stream, userId, name, contentType, maxBytes }, env = process.env) {
  if (!importKindOf(contentType)) throw refuse('Format non pris en charge.');
  const target = diskTarget(importPathname(userId, name, contentType), env);
  await mkdir(dirname(target.file), { recursive: true, mode: 0o755 });
  const temp = `${target.file}.${randomBytes(6).toString('hex')}.tmp`;

  try {
    await pipeline(stream, limiter(maxBytes), createWriteStream(temp, { flags: 'wx' }));

    const handle = await open(temp, 'r');
    const head = Buffer.alloc(16);
    let read = 0;
    try {
      ({ bytesRead: read } = await handle.read(head, 0, 16, 0));
    } finally {
      await handle.close();
    }
    if (!read) throw refuse('Fichier vide.');
    if (!typeMatches(contentType, detectImportType(head.subarray(0, read)))) {
      throw refuse('Le contenu du fichier ne correspond pas à son format.');
    }

    await chmod(temp, 0o644);
    await rename(temp, target.file);
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }

  return { url: target.url };
}
