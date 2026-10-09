import { layoutFacelessTimelineFromTrack } from './facelessTimeline.js';
import { buildFacelessHtml } from './facelessTemplate.js';
import { enqueueRender, renderFacelessStills } from './facelessRenderer.js';
import { loadPackAssets } from './facelessMedia.js';
import { normalizeFacelessStyle } from './facelessStyle.js';

/**
 * Apercu d une DA : trois images d une courte video type (accroche, liste,
 * appel a l action), sans voix ni appel payant. Sert la page "Direction
 * artistique" et les verifications visuelles.
 */

const SCENES = [
  { say: "Trois astuces pour mieux t'organiser.", layout: 'hook', text: "Les 3 astuces pour **t'organiser**", emoji: '✨', bg: 'main' },
  {
    say: 'Un, tu notes. Deux, tu planifies. Trois, tu fais.',
    layout: 'list',
    title: 'Le **plan**',
    items: [
      { emoji: '📝', text: 'Tu **notes**', at: 'notes.' },
      { emoji: '🗓️', text: 'Tu **planifies**', at: 'planifies.' },
      { emoji: '✅', text: 'Tu **fais**', at: 'fais.' },
    ],
    bg: 'alt',
  },
  { say: 'Abonne-toi pour la suite.', layout: 'avatar', text: 'Abonne-toi', captions: true, bg: 'dark' },
];

const WORD_SECONDS = 0.34;

/** Pur : plan d exemple, avatar choisi selon ce que la DA permet (images du pack ou dessin). */
export function buildPreviewPlan(style, packEntries = {}) {
  const ids = Object.keys(packEntries);
  const head = ids.filter((id) => packEntries[id].mode === 'head');
  const body = ids.filter((id) => packEntries[id].mode === 'body');
  const useCaptions = style.captions.enabled;

  const avatars = ids.length
    ? [
      { beats: [{ at: 0, expr: head[0] || ids[0] }] },
      { beats: [{ at: 0, expr: head[1] || head[0] || ids[0] }] },
      { beats: [{ at: 0, expr: body[0] || head[0] || ids[0] }] },
    ]
    : [
      { mode: 'head', pose: 'idle', beats: [{ at: 0, expr: 'surprised' }, { at: 'astuces', expr: 'happy' }] },
      { mode: 'head', pose: 'idle', beats: [{ at: 0, expr: 'thinking' }] },
      { mode: 'body', pose: 'wave', beats: [{ at: 0, expr: 'happy' }] },
    ];

  return {
    theme: style.preset,
    scenes: SCENES.map((scene, i) => ({
      ...scene,
      sfx: [],
      avatar: avatars[i],
      captions: Boolean(scene.captions) && useCaptions,
    })),
  };
}

/** Pur : mots minutes (une cadence reguliere) pour tout le script de l exemple. */
function syntheticTrack(plan) {
  const words = [];
  let cursor = 0;
  for (const scene of plan.scenes) {
    for (const text of scene.say.split(/\s+/).filter(Boolean)) {
      words.push({ text, start: cursor, end: cursor + WORD_SECONDS });
      cursor += WORD_SECONDS;
    }
    cursor += 0.15;
  }
  return { path: 'preview', duration: cursor, words };
}

/** Pur : { html, times } d un apercu (instants choisis apres la fin des entrees de chaque scene). */
export function buildPreviewPage(style, packEntries = {}) {
  const plan = buildPreviewPlan(style, packEntries);
  const timeline = layoutFacelessTimelineFromTrack(plan, syntheticTrack(plan), { leadIn: 0, gap: 0, tail: 0.6, visualLead: 0 });
  const html = buildFacelessHtml(timeline, { style, packEntries });
  const times = timeline.scenes.map((scene) => Number(Math.min(scene.end - 0.05, scene.start + 2.3).toFixed(2)));
  return { html, times, timeline, plan };
}

/**
 * Rend les trois images et les assemble en une bande JPEG.
 * Les images du pack utilisees sont telechargees (`readMedia` injectable).
 * @returns {Promise<Buffer>} JPEG
 */
export async function renderStylePreview({ style, packEntries = {}, readMedia } = {}) {
  const normalized = normalizeFacelessStyle(style);
  const { html, times, plan } = buildPreviewPage(normalized, packEntries);
  const assets = await loadPackAssets(plan, packEntries, readMedia);
  const { stills } = await enqueueRender(() => renderFacelessStills({ html, times, assets }));

  const sharp = (await import('sharp')).default;
  const frameW = 360;
  const frameH = 640;
  const gap = 14;
  const frames = await Promise.all(stills.map((s) => sharp(s.png).resize(frameW, frameH).png().toBuffer()));
  return sharp({ create: { width: frames.length * frameW + (frames.length - 1) * gap, height: frameH, channels: 3, background: '#ffffff' } })
    .composite(frames.map((input, i) => ({ input, left: i * (frameW + gap), top: 0 })))
    .jpeg({ quality: 84 })
    .toBuffer();
}
