/**
 * Catalogue du format "video faceless" : voix proposees, bruitages connus,
 * mises en page et expressions que Claude a le droit d utiliser.
 */

// Voix ElevenLabs "premade" qui parlent francais (verifie sur le compte le
// 2026-10-08). La premiere est la voix par defaut.
export const FACELESS_VOICES = [
  { id: 'cgSgspJ2msm6clMCkdW9', label: 'Jessica — jeune, pétillante', gender: 'female' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', label: 'Laura — enthousiaste, piquante', gender: 'female' },
  { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah — posée, rassurante', gender: 'female' },
  { id: 'XrExE9yKIg1WjnnlVkGX', label: 'Matilda — pédagogue, énergique', gender: 'female' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', label: 'Alice — claire, éducative', gender: 'female' },
  { id: 'bIHbv24MWmeRgasZH58o', label: 'Will — détendu, optimiste', gender: 'male' },
  { id: 'iP95p4xoKVk53GoZ742B', label: 'Chris — naturel, accessible', gender: 'male' },
  { id: 'cjVigY5qzO86Huf0OWal', label: 'Eric — calme, confiant', gender: 'male' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', label: 'George — conteur chaleureux', gender: 'male' },
];

export const DEFAULT_FACELESS_VOICE_ID = FACELESS_VOICES[0].id;

export function findFacelessVoice(voiceId) {
  return FACELESS_VOICES.find((voice) => voice.id === voiceId) || null;
}

// Bruitages generiques. Les fichiers vivent dans FACELESS_SFX_DIR (non suivis
// par Git : licence du pack a verifier avant toute distribution). Un fichier
// absent est simplement ignore au mixage.
export const FACELESS_SFX = {
  'paper/paper-cutout-place': 'papier pose (apparition d une carte)',
  'paper/paper-slide': 'papier qui glisse (entree laterale)',
  'paper/paper-flip': 'page tournee (nouveau chapitre)',
  'paper/sticker-peel': 'autocollant decolle (element de liste)',
  'paper/stamp-thump': 'tampon (affirmation forte)',
  'paper/scissors-snip': 'coup de ciseaux (coupe, rupture)',
  'paper/pencil-scribble': 'crayon (on note, on ecrit)',
  'paper/swish-soft': 'souffle doux (transition)',
  'girly/sparkle-twinkle': 'scintillement (bonne nouvelle)',
  'girly/sparkle-wand': 'baguette magique (revelation)',
  'girly/kawaii-pop': 'pop mignon (apparition)',
  'girly/heart-boop': 'coeur (amour, communaute)',
  'girly/cash-cute': 'caisse mignonne (argent gagne)',
  'girly/coin-spin': 'piece qui tourne (argent)',
  'girly/chime-ding-soft': 'ding doux (idee, validation)',
  'girly/harp-gliss': 'harpe (reve, projection)',
  'girly/cute-boing': 'boing (surprise legere)',
  'girly/mouse-click-soft': 'clic de souris',
  'ui/pop': 'pop (apparition rapide)',
  'transitions/whoosh-short': 'whoosh court (changement de sujet)',
  'fail-error/nope': 'nope (erreur a eviter)',
  'tension/clock-ticking-a': 'horloge (urgence)',
};

export const FACELESS_LAYOUTS = {
  hook: 'accroche : grande carte de texte (champ text) + emoji optionnel, avatar tete en bas',
  title: 'chapitre : number (ex "1") + title + text court + emoji optionnel',
  list: 'liste : title + items [{emoji, text, at}] (2 a 4 items) qui apparaissent sur un mot',
  avatar: 'avatar en buste qui monte du bas + courte carte text en haut ; ideal pour l appel a l action',
  word: 'un seul mot (champ word, 12 caracteres max) en tres grand + emoji optionnel',
};

export const FACELESS_POSES = ['idle', 'wave', 'point'];
