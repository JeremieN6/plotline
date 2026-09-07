import { existsSync } from 'node:fs';

import ffmpeg from 'fluent-ffmpeg';

import { configureFfmpeg } from './ffmpegBinaries.js';

configureFfmpeg(ffmpeg);

// Aucune police n est embarquee dans le depot : on tente d abord un chemin
// impose explicitement, puis les emplacements les plus courants sur une
// distribution Linux (VPS) et sur Windows (dev local). Si rien n est trouve,
// on omet `fontfile` et on laisse ffmpeg retomber sur fontconfig — l appelant
// doit alors etre pret a voir drawtext echouer avec un message clair plutot
// qu un plantage silencieux.
const CANDIDATE_FONT_PATHS = [
  process.env.DRAWTEXT_FONT_PATH,
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  'C:\\Windows\\Fonts\\arialbd.ttf',
].filter(Boolean);

function resolveDrawtextFont() {
  return CANDIDATE_FONT_PATHS.find((candidate) => existsSync(candidate)) || '';
}

// Les caracteres `\`, `:` et `%` ont un sens special dans la syntaxe de filtre
// ffmpeg. L apostrophe est remplacee par son equivalent typographique plutot
// qu echappee : drawtext utilise aussi le guillemet simple pour delimiter sa
// propre valeur, et l echappement a deux niveaux (filtre + shell) est fragile.
function escapeDrawtextValue(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%')
    .replace(/'/g, '\u2019');
}

export function applyHookTextOverlay(inputPath, hookText, outputPath) {
  const fontFile = resolveDrawtextFont();
  const drawtextOptions = {
    text: escapeDrawtextValue(hookText),
    fontcolor: 'white',
    fontsize: 48,
    box: 1,
    boxcolor: 'black@0.5',
    boxborderw: 20,
    x: '(w-text_w)/2',
    y: 'h*0.08',
  };

  if (fontFile) {
    drawtextOptions.fontfile = fontFile;
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters([{ filter: 'drawtext', options: drawtextOptions }])
      .outputOptions(['-codec:a', 'copy'])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (error) => {
        const hint = fontFile ? '' : ' (aucune police trouvee sur ce serveur — definir DRAWTEXT_FONT_PATH ou installer une police type DejaVu/Liberation)';
        reject(new Error(`Overlay ffmpeg drawtext echoue${hint}: ${error.message}`));
      })
      .run();
  });
}
