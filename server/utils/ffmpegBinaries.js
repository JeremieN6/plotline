import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

/**
 * Resolution des binaires ffmpeg et ffprobe, a l execution uniquement.
 *
 * Les modules `ffmpeg-static` et `ffprobe-static` etaient importes statiquement.
 * Nitro trace ces imports au build et exige le binaire, meme si aucune ligne ne
 * s execute: un `npm ci` qui n a pas telecharge le binaire (scripts d install
 * bloques par npm) faisait donc echouer le build entier, pour une fonctionnalite
 * qui ne concerne que le workflow Reel Pinterest.
 *
 * On resout donc a l execution, avec un specificateur non litteral que l analyse
 * statique ne peut pas suivre. Le build ne depend plus d aucun binaire.
 */

const require = createRequire(import.meta.url);

// Specificateurs assembles a l execution: ecrits en clair, ils seraient traces.
const MODULE_NAMES = {
  ffmpeg: ['ffmpeg', 'static'].join('-'),
  ffprobe: ['ffprobe', 'static'].join('-'),
};

let cached = null;

function resolveFromModule(moduleName, readPath) {
  try {
    const loaded = require(moduleName);
    const candidate = readPath(loaded?.default ?? loaded);
    return candidate && existsSync(candidate) ? candidate : '';
  } catch {
    return '';
  }
}

function resolveBinary({ envVar, moduleName, readPath, systemName }) {
  // 1. Chemin impose explicitement: c est le seul moyen fiable sur un serveur
  //    ou le binaire vient du gestionnaire de paquets.
  const fromEnv = String(process.env[envVar] || '').trim();
  if (fromEnv && existsSync(fromEnv)) {
    return { path: fromEnv, source: envVar };
  }

  // 2. Paquet npm, quand son script d installation a bien tourne.
  const fromModule = resolveFromModule(moduleName, readPath);
  if (fromModule) {
    return { path: fromModule, source: moduleName };
  }

  // 3. Binaire du systeme: fluent-ffmpeg le cherchera dans le PATH.
  return { path: systemName, source: 'PATH' };
}

/**
 * Les chemins sont calcules une seule fois: ce sont des verifications de
 * fichiers, inutile de les refaire a chaque generation.
 */
export function resolveFfmpegPaths() {
  if (cached) return cached;

  const ffmpeg = resolveBinary({
    envVar: 'FFMPEG_PATH',
    moduleName: MODULE_NAMES.ffmpeg,
    readPath: (loaded) => (typeof loaded === 'string' ? loaded : loaded?.path),
    systemName: 'ffmpeg',
  });

  const ffprobe = resolveBinary({
    envVar: 'FFPROBE_PATH',
    moduleName: MODULE_NAMES.ffprobe,
    readPath: (loaded) => (typeof loaded === 'string' ? loaded : loaded?.path),
    systemName: 'ffprobe',
  });

  cached = { ffmpegPath: ffmpeg.path, ffprobePath: ffprobe.path };
  return cached;
}

/** Branche fluent-ffmpeg sur les binaires resolus. */
export function configureFfmpeg(ffmpegInstance) {
  const { ffmpegPath, ffprobePath } = resolveFfmpegPaths();

  ffmpegInstance.setFfmpegPath(ffmpegPath);
  ffmpegInstance.setFfprobePath(ffprobePath);

  return ffmpegInstance;
}
