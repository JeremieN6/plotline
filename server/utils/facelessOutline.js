/**
 * Trame a dire pour le mode "ma voix" : pas un script a lire mot a mot (ca
 * sonnerait lu), mais des temps forts avec les idees a couvrir, une phrase
 * d exemple a reformuler, et des indications de montage que le createur peut
 * dire a voix haute. Texte seulement, quelques centimes.
 */

import Anthropic from '@anthropic-ai/sdk';

import { describeFacelessPersona, normalizeFacelessDuration, parseFacelessPlanResponse } from './facelessPlanGenerator.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

// Conseils d enregistrement : constants, pas besoin de Claude pour les ecrire.
export const RECORDING_TIPS = [
  'Enregistre dans une pièce calme (un placard avec des vêtements fait un excellent studio), le micro du téléphone à 15-20 cm de la bouche.',
  'Parle comme à une amie, pas comme si tu lisais : des phrases courtes, un temps pour respirer entre deux idées.',
  'Tu te rates ? Fais une pause d’une seconde et reprends la phrase depuis le début : la reprise est repérée et la mauvaise prise supprimée.',
  'Tu peux dire une indication de montage à voix haute, au bon moment (« là, change de fond », « ici, l’avatar est surpris ») : elle sera appliquée puis retirée de la voix.',
  'Un seul fichier, sans musique ni bruit de fond. Mp3, wav, m4a, ogg, flac ou webm, 25 Mo maximum.',
];

export function buildOutlineSystemPrompt({ targetSeconds = 30, persona = null } = {}) {
  const personaText = describeFacelessPersona(persona);
  return [
    'Tu aides un createur a ENREGISTRER SA PROPRE VOIX pour une video verticale "faceless" (TikTok, Reels) : voix off, avatar qui reagit, cartes animees.',
    `Tu lui prepares une TRAME a suivre pour une video d environ ${targetSeconds} secondes (environ ${Math.round(targetSeconds * 2.6)} mots dits).`,
    'Ce n est PAS un script a lire : une trame de 4 a 7 temps forts. Pour chaque temps fort :',
    '- "label" : son nom (ex. "Accroche", "Le probleme", "Etape 1", "Appel a l action"),',
    '- "goal" : ce que ce passage doit faire ressentir ou comprendre, en une phrase,',
    '- "points" : 1 a 3 idees a couvrir, courtes,',
    '- "example" : UNE phrase d exemple, orale et naturelle, que le createur reformulera avec ses mots,',
    '- "seconds" : duree approximative,',
    '- "cue" (facultatif) : une indication de montage qu il peut dire a voix haute pendant ce passage (ex. "la, fond sombre", "ici, l avatar est surpris", "affiche le chiffre 3").',
    'Le premier temps fort est une ACCROCHE (promesse, question, contraste), le dernier un appel a l action. Tutoiement, francais oral.',
    'Les indications "cue" sont en langage naturel, comme on les dirait a un monteur ("la, fond sombre", "ici, l avatar est surpris", "affiche le chiffre 3") : jamais de terme technique (layout, hook, scene...).',
    '- Jamais de chiffres de revenus inventes, de promesse de gain garantie, de fausses statistiques. Aucune marque deposee.',
    personaText ? `\nPERSONA QUI PARLE (respecte son ton et son public) :\n${personaText}` : '',
    '',
    'Reponds uniquement avec un objet JSON brut : {"title": string, "beats": [{"label": string, "goal": string, "points": [string], "example": string, "seconds": number, "cue"?: string}]}',
  ].filter((line) => line !== '').join('\n');
}

const clip = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Pur : trame nettoyee, ou erreur si inexploitable. */
export function sanitizeOutline(raw) {
  const beats = (Array.isArray(raw?.beats) ? raw.beats : []).slice(0, 8).map((beat) => ({
    label: clip(beat?.label, 40),
    goal: clip(beat?.goal, 200),
    points: (Array.isArray(beat?.points) ? beat.points : []).slice(0, 3).map((p) => clip(p, 140)).filter(Boolean),
    example: clip(beat?.example, 260),
    seconds: Math.max(1, Math.min(60, Math.round(Number(beat?.seconds) || 5))),
    cue: clip(beat?.cue, 120),
  })).filter((beat) => beat.label && (beat.example || beat.points.length));

  if (beats.length < 2) throw new Error('Trame inexploitable (moins de 2 temps forts)');
  return { title: clip(raw?.title, 80), beats, tips: RECORDING_TIPS };
}

/** Appel Claude. `createMessage` est injectable (tests). */
export async function generateOutline({ idea, persona, targetSeconds, apiKey, createMessage } = {}) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!createMessage && !key) throw new Error('ANTHROPIC_API_KEY non configuree');
  if (!String(idea || '').trim()) throw new Error('Idee requise');

  const request = {
    model: String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    max_tokens: 3000,
    system: buildOutlineSystemPrompt({ targetSeconds: normalizeFacelessDuration(targetSeconds), persona }),
    messages: [{ role: 'user', content: `Idee de la video :\n${String(idea).trim()}` }],
  };
  const response = await (createMessage ? createMessage(request) : new Anthropic({ apiKey: key }).messages.create(request));
  const text = (response?.content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('\n');
  return sanitizeOutline(parseFacelessPlanResponse(text));
}
