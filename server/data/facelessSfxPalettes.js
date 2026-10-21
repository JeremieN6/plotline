/**
 * Palettes de bruitages par direction artistique. Chaque son du catalogue a un ROLE (ce qu il souligne :
 * une apparition, un element de liste, une affirmation forte...) ; chaque palette dit quel son joue chaque
 * role pour cette DA (ou null : pas de son pour ce role). Claude ne voit que les sons de la palette ; un
 * son hors palette (ancien plan, retouche) est remplace par l equivalent de meme role, ou supprime.
 */

export const FACELESS_SFX_ROLES = {
  'paper/paper-cutout-place': 'appear',
  'paper/paper-slide': 'transition',
  'paper/paper-flip': 'chapter',
  'paper/sticker-peel': 'item',
  'paper/stamp-thump': 'strong',
  'paper/scissors-snip': 'cut',
  'paper/pencil-scribble': 'write',
  'paper/swish-soft': 'transition',
  'girly/sparkle-twinkle': 'good',
  'girly/sparkle-wand': 'reveal',
  'girly/kawaii-pop': 'appear',
  'girly/heart-boop': 'love',
  'girly/cash-cute': 'money',
  'girly/coin-spin': 'money',
  'girly/chime-ding-soft': 'idea',
  'girly/harp-gliss': 'reveal',
  'girly/cute-boing': 'surprise',
  'girly/mouse-click-soft': 'click',
  'ui/pop': 'appear',
  'transitions/whoosh-short': 'transition',
  'fail-error/nope': 'error',
  'tension/clock-ticking-a': 'urgency',
  'tech/key-tap': 'write',
  'tech/terminal-blip': 'item',
  'tech/confirm': 'good',
  'tech/error-buzz': 'error',
  'tech/boot-sweep': 'reveal',
  'tech/data-tick': 'click',
  'impact/hit': 'strong',
};

const ROLES = ['appear', 'item', 'chapter', 'strong', 'cut', 'write', 'transition', 'good', 'reveal', 'idea', 'love', 'money', 'click', 'surprise', 'error', 'urgency'];
const palette = (label, byRole) => ({ label, byRole: Object.fromEntries(ROLES.map((role) => [role, byRole[role] ?? null])) });

export const FACELESS_SFX_PALETTES = {
  // Terminal, Editeur, Fenetre, Dashboard : interface, clavier, terminal.
  tech: palette('technique (clavier, terminal, interface)', {
    appear: 'ui/pop', item: 'tech/terminal-blip', chapter: 'transitions/whoosh-short', strong: 'tech/confirm', cut: 'transitions/whoosh-short',
    write: 'tech/key-tap', transition: 'transitions/whoosh-short', good: 'tech/confirm', reveal: 'tech/boot-sweep', idea: 'tech/confirm',
    money: 'tech/data-tick', click: 'girly/mouse-click-soft', surprise: 'ui/pop', error: 'tech/error-buzz', urgency: 'tension/clock-ticking-a',
  }),
  // Brutal, Hanko : coups secs, tampons.
  impact: palette('impact (tampon, coup sec)', {
    appear: 'ui/pop', item: 'ui/pop', chapter: 'transitions/whoosh-short', strong: 'paper/stamp-thump', cut: 'impact/hit', transition: 'transitions/whoosh-short',
    good: 'ui/pop', reveal: 'impact/hit', click: 'ui/pop', surprise: 'ui/pop', error: 'fail-error/nope', urgency: 'tension/clock-ticking-a',
  }),
  // Cahier, kraft : papier, crayon.
  paper: palette('papier (crayon, page, tampon)', {
    appear: 'paper/paper-cutout-place', item: 'paper/sticker-peel', chapter: 'paper/paper-flip', strong: 'paper/stamp-thump', cut: 'paper/scissors-snip',
    write: 'paper/pencil-scribble', transition: 'paper/paper-slide', good: 'ui/pop', reveal: 'paper/swish-soft', idea: 'ui/pop', click: 'ui/pop',
    surprise: 'ui/pop', error: 'fail-error/nope', urgency: 'tension/clock-ticking-a',
  }),
  // Herbier, Journal, Atelier, luxe : discret, doux.
  soft: palette('doux (souffle, carillon, papier)', {
    appear: 'paper/paper-cutout-place', item: 'paper/paper-cutout-place', chapter: 'paper/swish-soft', strong: 'ui/pop', write: 'paper/pencil-scribble',
    transition: 'paper/swish-soft', good: 'girly/sparkle-twinkle', reveal: 'girly/chime-ding-soft', idea: 'girly/chime-ding-soft', click: 'girly/mouse-click-soft',
    surprise: 'ui/pop', error: 'fail-error/nope',
  }),
  // Pop jaune : ludique.
  playful: palette('ludique (pop, scintillement, coeur)', {
    appear: 'girly/kawaii-pop', item: 'ui/pop', chapter: 'transitions/whoosh-short', strong: 'paper/stamp-thump', cut: 'paper/scissors-snip', write: 'paper/pencil-scribble',
    transition: 'transitions/whoosh-short', good: 'girly/sparkle-twinkle', reveal: 'girly/sparkle-wand', idea: 'girly/chime-ding-soft', love: 'girly/heart-boop',
    money: 'girly/cash-cute', click: 'girly/mouse-click-soft', surprise: 'girly/cute-boing', error: 'fail-error/nope', urgency: 'tension/clock-ticking-a',
  }),
};

// Sons proposes par la palette "full" (DA personnalisee ou papercraft d origine) : les 22 sons historiques.
export const FACELESS_SFX_LEGACY = Object.keys(FACELESS_SFX_ROLES).filter((name) => !name.startsWith('tech/') && !name.startsWith('impact/'));

// Modeles visuels -> palette ; les modeles "classic" se choisissent par preset (voir facelessSfxPlan.js).
export const FACELESS_SFX_BY_TEMPLATE = {
  fenetre: 'tech', editeur: 'tech', dashboard: 'tech', cahier: 'paper', brutal: 'impact', hanko: 'impact', herbier: 'soft', journal: 'soft',
};
export const FACELESS_SFX_BY_PRESET = {
  terminal: 'tech', 'neon-nuit': 'tech', brutalisme: 'impact', 'cahier-ecolier': 'paper', 'kraft-carnet': 'paper',
  'luxe-minimal': 'soft', 'atelier-vert': 'soft', 'atelier-bleu': 'soft', 'atelier-bordeaux': 'soft', 'pop-jaune': 'playful',
};
