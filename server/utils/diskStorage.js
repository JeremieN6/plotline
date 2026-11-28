// Stockage des medias sur le disque du serveur, servis par nginx sous /media/ (voir docs/stockage-disque.md).
// Actif seulement avec MEDIA_STORAGE=disk. Les adresses enregistrees en base sont ABSOLUES et publiques, comme
// l etaient celles de Vercel Blob : publication reseau, affichage et lecture serveur fonctionnent sans autre changement.
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, readdir, rename, stat, statfs, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

// Seuls ces types sont ecrits : les fichiers sont servis depuis le domaine de l application, un HTML ou un SVG
// depose ici pourrait y executer du script.
export const DISK_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'webm', 'mp3', 'json'];
// Place toujours laissee libre sur le serveur (base de la machine, builds, autres projets).
export const DISK_RESERVE_BYTES = 5 * 1024 * 1024 * 1024;

export function isDiskStorageEnabled(env = process.env) {
  return String(env.MEDIA_STORAGE || '').trim().toLowerCase() === 'disk';
}

/** Dossier des medias : obligatoire, absolu et HORS du projet (un deploiement ne doit jamais pouvoir l effacer). */
export function getDiskRoot(env = process.env, cwd = process.cwd()) {
  const raw = String(env.MEDIA_STORAGE_DIR || '').trim();
  if (!raw || !isAbsolute(raw)) throw new Error('MEDIA_STORAGE_DIR doit être un chemin absolu.');
  const root = resolve(raw);
  const fromProject = relative(resolve(cwd), root);
  const inside = fromProject === '' || (!fromProject.startsWith('..') && !isAbsolute(fromProject));
  if (inside) throw new Error('MEDIA_STORAGE_DIR doit être en dehors du dossier du projet.');
  return root;
}

/** Adresse publique du dossier : MEDIA_PUBLIC_BASE_URL, sinon BASE_URL + /media. */
export function getDiskPublicBase(env = process.env) {
  const explicit = String(env.MEDIA_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  const base = String(env.BASE_URL || '').trim().replace(/\/+$/, '');
  const value = explicit || (base ? `${base}/media` : '');
  if (!/^https?:\/\/[^/]+/i.test(value)) throw new Error('MEDIA_PUBLIC_BASE_URL (ou BASE_URL) doit être une adresse complète.');
  return value;
}

/** Pur : segments d un chemin relatif sur, ou null (remontee, segment cache, caractere inattendu). */
export function safeSegments(pathname) {
  const segments = String(pathname || '').split('/').filter(Boolean);
  if (!segments.length) return null;
  const ok = segments.every((segment) => /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(segment) && !segment.includes('..'));
  return ok ? segments : null;
}

export function extensionOf(pathname) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(String(pathname || ''));
  return match ? match[1].toLowerCase() : '';
}

/** Chemin disque et adresse publique d un media a ecrire ; leve si le chemin ou le type est refuse. */
export function diskTarget(pathname, env = process.env, cwd = process.cwd()) {
  const segments = safeSegments(pathname);
  if (!segments) throw new Error('Chemin de média refusé.');
  if (!DISK_ALLOWED_EXTENSIONS.includes(extensionOf(pathname))) throw new Error('Type de média refusé.');
  return {
    pathname: segments.join('/'),
    file: join(getDiskRoot(env, cwd), ...segments),
    url: `${getDiskPublicBase(env)}/${segments.join('/')}`,
  };
}

/** Chemin disque d une adresse de CE stockage, ou null (autre domaine, ancien Blob, chemin douteux, mode inactif). */
export function diskPathForUrl(mediaUrl, env = process.env, cwd = process.cwd()) {
  if (!isDiskStorageEnabled(env)) return null;
  const url = String(mediaUrl || '').trim().split(/[?#]/)[0];
  let base;
  let root;
  try {
    base = getDiskPublicBase(env);
    root = getDiskRoot(env, cwd);
  } catch {
    return null;
  }
  if (!url.startsWith(`${base}/`)) return null;
  const segments = safeSegments(url.slice(base.length + 1));
  if (!segments) return null;
  const file = join(root, ...segments);
  return file.startsWith(root + sep) ? file : null;
}

/** Ecrit un media (fichier temporaire puis renommage : jamais de fichier a moitie ecrit sous son nom final). */
export async function writeDiskMedia(pathname, buffer, env = process.env) {
  const target = diskTarget(pathname, env);
  await mkdir(dirname(target.file), { recursive: true, mode: 0o755 });
  const temp = `${target.file}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    await writeFile(temp, buffer);
    await chmod(temp, 0o644); // lisible par nginx quel que soit le umask
    await rename(temp, target.file);
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
  return { pathname: target.pathname, url: target.url };
}

async function directorySize(dir) {
  let bytes = 0;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return 0;
    throw error;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) bytes += await directorySize(full);
    else if (entry.isFile()) bytes += (await stat(full).catch(() => ({ size: 0 }))).size;
  }
  return bytes;
}

/** Place occupee par les medias et place encore utilisable (disque libre moins la reserve). */
export async function getDiskUsage(env = process.env) {
  const root = getDiskRoot(env);
  const fsInfo = await statfs(root);
  const free = Number(fsInfo.bavail) * Number(fsInfo.bsize);
  return { bytes: await directorySize(root), availableBytes: Math.max(0, free - DISK_RESERVE_BYTES) };
}
