/**
 * Catalogue du pack d avatars (images generees a partir de l image de base de
 * la persona). Chaque entree = une image : `mode` "head" (tete seule) ou "body"
 * (buste / corps), `label` (francais, pour l interface et pour Claude) et
 * `prompt` (anglais, pour le modele d image).
 */

export const AVATAR_PACK_CATALOG = [
  // Tetes seules
  { id: 'neutral', mode: 'head', label: 'Neutre', prompt: 'calm neutral expression, slight closed-mouth smile' },
  { id: 'happy', mode: 'head', label: 'Content', prompt: 'big happy smile, eyes closed in joy' },
  { id: 'laugh', mode: 'head', label: 'Éclat de rire', prompt: 'laughing out loud, open mouth, eyes squeezed shut, blushing cheeks' },
  { id: 'wink', mode: 'head', label: 'Clin d\'œil', prompt: 'playful wink with one eye, tongue slightly out' },
  { id: 'cat-eyes', mode: 'head', label: 'Yeux de chat', prompt: 'eyes closed shaped like a sideways V (cat eyes, rotated 90 degrees), cute smug smile' },
  { id: 'surprised', mode: 'head', label: 'Surpris', prompt: 'wide open eyes, raised eyebrows, small open mouth, a sweat drop' },
  { id: 'shocked', mode: 'head', label: 'Choqué', prompt: 'jaw dropped, eyes very wide, shocked expression' },
  { id: 'thinking', mode: 'head', label: 'Réfléchit', prompt: 'thinking, eyes looking up to the side, one eyebrow raised, small smirk' },
  { id: 'sad', mode: 'head', label: 'Triste', prompt: 'sad, downturned mouth, worried eyebrows, a small tear' },
  { id: 'crying', mode: 'head', label: 'Pleure', prompt: 'crying with streams of tears, mouth open wobbly' },
  { id: 'love', mode: 'head', label: 'Amoureux', prompt: 'heart-shaped eyes, blushing, adoring smile' },
  { id: 'smug', mode: 'head', label: 'Sûr de soi', prompt: 'half-closed confident eyes, smug smirk, one raised eyebrow' },
  { id: 'angry', mode: 'head', label: 'Énervé', prompt: 'angry, furrowed eyebrows, gritted teeth, small steam puffs' },
  { id: 'sleepy', mode: 'head', label: 'Fatigué', prompt: 'sleepy, droopy half-closed eyes, big yawn, tiny Z letters' },
  // Buste / corps
  { id: 'body-neutral', mode: 'body', label: 'Debout', prompt: 'standing relaxed, arms at the sides, friendly smile, upper body to the waist' },
  { id: 'body-wave', mode: 'body', label: 'Salue', prompt: 'waving hello with one raised hand, big smile, upper body to the waist' },
  { id: 'body-point', mode: 'body', label: 'Montre du doigt', prompt: 'pointing to the side with one arm extended, confident smile, upper body' },
  { id: 'body-thumbs-up', mode: 'body', label: 'Pouce levé', prompt: 'thumbs up with one hand, encouraging wink, upper body' },
  { id: 'body-peace', mode: 'body', label: 'Signe V', prompt: 'making a V peace sign near the face, cheerful, upper body' },
  { id: 'body-slay', mode: 'body', label: 'Slay', prompt: 'showing the back of the hand with painted nails, sassy "slay" attitude, upper body' },
  { id: 'body-hands-up', mode: 'body', label: 'Bras en l\'air', prompt: 'both arms up in celebration, huge joyful smile, upper body' },
  { id: 'body-shrug', mode: 'body', label: 'Hausse les épaules', prompt: 'shrugging with both palms open, puzzled look, upper body' },
  { id: 'body-arms-crossed', mode: 'body', label: 'Bras croisés', prompt: 'arms crossed, serious skeptical look, upper body' },
  { id: 'body-chin-hand', mode: 'body', label: 'Main au menton', prompt: 'hand on chin in thought, looking up, upper body' },
  { id: 'body-phone', mode: 'body', label: 'Sur son téléphone', prompt: 'holding a smartphone in both hands, looking at it, upper body' },
  { id: 'body-laptop', mode: 'body', label: 'Sur son ordinateur', prompt: 'typing on a laptop in front of the character, focused, upper body' },
  { id: 'body-money', mode: 'body', label: 'Billets en main', prompt: 'holding a fan of banknotes, delighted expression, upper body' },
  { id: 'body-heart-hands', mode: 'body', label: 'Cœur avec les mains', prompt: 'making a heart shape with both hands, blushing smile, upper body' },
];

export const AVATAR_PACK_IDS = AVATAR_PACK_CATALOG.map((entry) => entry.id);

export function findCatalogEntry(id) {
  return AVATAR_PACK_CATALOG.find((entry) => entry.id === id) || null;
}

// Tarif indicatif d une image du modele utilise (a verifier sur la console Google).
export const IMAGE_COST_USD = 0.134;

/** Pur : estimation du cout (en dollars) de n images, arrondie au centime. */
export function estimatePackCostUsd(count) {
  return Math.round(Math.max(0, count) * IMAGE_COST_USD * 100) / 100;
}
