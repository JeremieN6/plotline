/**
 * Patterns de prompts cures depuis tmp/autres/PROMPTS.md (voir la proposition
 * validee le 2026-09-23/24 -- decisions dans les notes de session de CLAUDE.md).
 *
 * Chaque pattern REUTILISE un widget existant de server/data/widgets.js (memes
 * variables, memes assets, meme moteur de resolution) : il ne fait que fournir
 * un `template` et/ou des `assistHintOverrides` differents de ceux du widget de
 * base. Voir `buildEffectiveWidget` (server/utils/promptPatternSelector.js)
 * pour la fusion.
 *
 * Deux niveaux de restriction, orthogonaux :
 * - `accountTypeRestriction` : qui peut SELECTIONNER ce pattern (Studio manuel
 *   ou cadence). `null` = tous les types de compte.
 * - `automatable` : si `true`, ce pattern peut etre choisi par le routage
 *   automatique de la cadence (`CUSTOM_PROMPT_STUDIO`, approve.post.js). Un
 *   contenu genere par la cadence peut ensuite etre auto-publie sur Instagram
 *   par `scheduledPublisher` une fois valide -- aucun pattern au ton plus
 *   pousse ne doit donc jamais etre `automatable`, quel que soit son
 *   `accountTypeRestriction`. Ces contenus restent Studio manuel uniquement.
 *
 * `selectable: false` = present dans les donnees pour tracabilite/reference,
 * mais aucun code ne doit le proposer -- reserve a un futur mecanisme de
 * consentement explicite (non concu dans ce lot).
 */

export const PROMPT_PATTERNS = [
  {
    id: 'PORTRAIT_COZY_HOME',
    nom: 'Portrait cozy home selfie',
    type: 'IMAGE',
    widgetId: 'PORTRAIT_STUDIO',
    tier: null,
    accountTypeRestriction: null,
    selectable: true,
    automatable: true,
    tags: ['lifestyle', 'portrait', 'cozy', 'interieur'],
    template:
      'Casual intimate home portrait selfie of {{persona.description}}, {{cadrage}}, taken slightly below face level. She wears {{tenue}}, one shoulder loosely exposed, hair in a deep side part with a strand falling over one eye. Head tilted, cheek resting gently on a raised fist. Setting: {{decor}}, plain warm-gray monochrome background, no visible details. {{lumiere}}, one side of the face softly lit, the other in gentle shadow, low upward angle. {{style_photo}} aesthetic, cozy and intimate mood, {{aspect_ratio}} composition, large portrait framing from shoulders to crown.',
    negativePrompt: null,
    assistHintOverrides: null,
    statut: 'experimental',
    limites: 'Jamais teste avec un vrai rendu Plotline -- repose entierement sur le pipeline PORTRAIT_STUDIO (Gemini + face ref) deja eprouve.',
    source: 'tmp/autres/PROMPTS.md #59',
  },
  {
    id: 'PORTRAIT_GOLDEN_HOUR_TIER_A',
    nom: 'Portrait golden hour bord de mer (adouci)',
    type: 'IMAGE',
    widgetId: 'PORTRAIT_STUDIO',
    tier: 'A',
    accountTypeRestriction: 'INFLUENCER_CREATOR',
    selectable: true,
    automatable: false,
    tags: ['lifestyle', 'portrait', 'exterieur', 'golden-hour', 'mer'],
    template:
      'Ultra-photorealistic portrait of {{persona.description}}, {{cadrage}}, keeping the face and identity fully consistent with the reference. She wears {{tenue}}, standing at a slight angle, one hand resting on her hip, confident and relaxed posture. Setting: {{decor}}, a bright sunny Mediterranean cliffside balcony with a distant sea view, clear sky. {{lumiere}}, strong golden-hour sunlight with soft highlights and gentle shadows. {{style_photo}} aesthetic, shallow depth of field, editorial fashion photography, {{aspect_ratio}} composition.',
    negativePrompt: null,
    assistHintOverrides: null,
    statut: 'experimental',
    limites: 'Jamais teste avec un vrai rendu Plotline. Adouci pour eviter un blocage IMAGE_SAFETY Gemini (tenue/pose neutralisees par rapport a la source), pas garanti sans blocage pour autant.',
    source: 'tmp/autres/PROMPTS.md #58 (adouci, palier A)',
  },
  {
    id: 'PORTRAIT_GOLDEN_HOUR_TIER_B',
    nom: 'Portrait golden hour bord de mer (original)',
    type: 'IMAGE',
    widgetId: 'PORTRAIT_STUDIO',
    tier: 'B',
    accountTypeRestriction: 'INFLUENCER_CREATOR',
    // Reserve : aucun code ne doit selectionner ce pattern pour l instant (pas
    // de mecanisme de consentement explicite concu). Present pour tracabilite
    // uniquement -- voir la note en tete de fichier.
    selectable: false,
    automatable: false,
    tags: ['lifestyle', 'portrait', 'exterieur', 'golden-hour', 'mer'],
    template:
      'Ultra-photorealistic portrait of {{persona.description}}, {{cadrage}}, keeping the face and identity fully consistent with the reference. She wears {{tenue}} -- a fitted, form-revealing outfit with an open draped layer, one shoulder exposed -- standing at a slight angle, one hand resting on her hip, confident and relaxed posture, subtle sun-kissed sheen on the skin. Setting: {{decor}}, a bright sunny Mediterranean cliffside balcony with a distant sea view, clear sky. {{lumiere}}, strong golden-hour sunlight with soft highlights and gentle shadows. {{style_photo}} aesthetic, shallow depth of field, editorial fashion photography, {{aspect_ratio}} composition.',
    negativePrompt: null,
    assistHintOverrides: null,
    statut: 'experimental',
    limites: 'Jamais teste. Reserve a un futur mecanisme de consentement explicite (non concu dans ce lot) -- ne pas rendre selectionnable sans lui.',
    source: 'tmp/autres/PROMPTS.md #58 (texte original, palier B)',
  },
  {
    id: 'SELFIE_MIROIR_TIER_A',
    nom: 'Selfie miroir chambre (adouci)',
    type: 'IMAGE',
    widgetId: 'PORTRAIT_STUDIO',
    tier: 'A',
    accountTypeRestriction: 'INFLUENCER_CREATOR',
    selectable: true,
    automatable: false,
    tags: ['lifestyle', 'selfie', 'miroir', 'interieur'],
    template:
      'Mirror selfie of {{persona.description}}, standing relaxed in front of the mirror, full body visible with emphasis on upper torso and face, confident and natural gaze directly into the mirror. She wears {{tenue}} -- an oversized cream knit sweater, cozy loose fit -- holding a smartphone in a gold case. Setting: {{decor}}, bedroom with a white metal bed frame and rumpled white sheets, plain light-gray walls, soft gray carpet. {{lumiere}}, soft even diffused indoor lighting, minimal shadows. {{cadrage}}, mirror selfie perspective, eye-level angle, {{aspect_ratio}} vertical composition, sharp focus on subject with slight background softness. {{style_photo}} aesthetic, casual confident social-media mood, natural skin texture.',
    negativePrompt: null,
    assistHintOverrides: null,
    statut: 'experimental',
    limites: 'Jamais teste. Adouci pour eviter un blocage IMAGE_SAFETY Gemini (pose et decollete neutralises par rapport a la source), pas garanti sans blocage pour autant.',
    source: 'tmp/autres/PROMPTS.md #76 (adouci, palier A -- ligne "Alia Bhatt lookalike" retiree : l identite vient deja de la face ref)',
  },
  {
    id: 'SELFIE_MIROIR_TIER_B',
    nom: 'Selfie miroir chambre (original)',
    type: 'IMAGE',
    widgetId: 'PORTRAIT_STUDIO',
    tier: 'B',
    accountTypeRestriction: 'INFLUENCER_CREATOR',
    selectable: false,
    automatable: false,
    tags: ['lifestyle', 'selfie', 'miroir', 'interieur'],
    template:
      'Mirror selfie of {{persona.description}}, kneeling on a soft gray carpet, legs bent and apart, full body visible with emphasis on upper torso and face, confident relaxed gaze directly into the mirror. She wears {{tenue}} -- an oversized cream knit sweater, off-shoulder on both sides, deep plunging V-neck, with pink satin ribbon bow details -- loose and cozy fit, holding a smartphone in a gold case. Setting: {{decor}}, bedroom with a white metal bed frame and rumpled white sheets, plain light-gray walls, soft gray carpet. {{lumiere}}, soft even diffused indoor lighting, minimal shadows. {{cadrage}}, mirror selfie perspective, eye-level angle, {{aspect_ratio}} vertical composition, sharp focus on subject with slight background softness. {{style_photo}} aesthetic, casual confident social-media mood, natural skin texture.',
    negativePrompt: null,
    assistHintOverrides: null,
    statut: 'experimental',
    limites: 'Jamais teste. Reserve a un futur mecanisme de consentement explicite (non concu dans ce lot) -- ne pas rendre selectionnable sans lui.',
    source: 'tmp/autres/PROMPTS.md #76 (texte original moins la ligne "Alia Bhatt lookalike", palier B)',
  },
  {
    id: 'SCENARIO_CONVERSATIONNEL',
    nom: 'Scenario conversationnel renforce',
    type: 'VIDEO',
    widgetId: 'SCENARIO_BLOG',
    tier: null,
    accountTypeRestriction: null,
    selectable: true,
    automatable: true,
    tags: ['video', 'scenario', 'conversationnel'],
    // Pas de template de substitution (celui de SCENARIO_BLOG est deja minimal,
    // `{{scenePrompt}}`) : le renforcement porte sur la consigne donnee a
    // Claude pour REMPLIR scenePrompt/scriptText, pas sur l assemblage final.
    template: null,
    negativePrompt: null,
    assistHintOverrides: {
      scenePrompt:
        'Decrit la scene a generer : decor, cadrage, ambiance, un seul lieu net et concret (pas de collage ni de montage). Concret et visuel, en anglais (les modeles video suivent mieux l anglais). Pas de texte a incruster, pas de dialogue dedans, pas de description du personnage (elle vient de la face ref ou est laissee libre au modele).',
      scriptText:
        'Texte parle par le personnage a l ecran, en francais, 15 a 25 mots, une seule phrase percutante avec une vraie accroche (question, chiffre, affirmation qui tranche), tutoiement, adresse directe a la camera comme dans une prise de parole spontanee filmee au telephone. Pas de guillemets, pas de didascalie, pas de ton publicitaire.',
    },
    statut: 'experimental',
    limites: 'Renforce le texte demande a Claude, pas le pipeline de generation lui-meme (deja eprouve via /api/external/video-jobs et le widget Studio existant).',
    source: 'tmp/autres/PROMPTS.md #13, #16',
  },
];

export function getPromptPatterns() {
  return PROMPT_PATTERNS;
}

export function getPromptPatternById(id) {
  const key = String(id || '').trim().toUpperCase();
  return PROMPT_PATTERNS.find((pattern) => pattern.id === key) || null;
}
