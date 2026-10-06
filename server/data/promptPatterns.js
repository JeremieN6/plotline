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
  {
    id: 'UGC_AVIS_PARLE',
    nom: 'UGC avis parle au telephone (15s)',
    type: 'VIDEO',
    widgetId: 'SCENARIO_BLOG',
    tier: null,
    accountTypeRestriction: null,
    selectable: true,
    // Jamais automatique : un avis produit n a pas de sens sans produit choisi
    // par l utilisateur (aucun packshot n existe dans ce parcours).
    automatable: false,
    tags: ['video', 'ugc', 'avis', 'produit', 'parle'],
    // La structure (chronologie, plans, objectifs) est demandee a Claude via
    // assistHintOverrides ; le template n ajoute que le paragraphe de jeu et les
    // contraintes de realisme, repris de #78 et du prompt "UGC Ad Director".
    template:
      '{{scenePrompt}} Use natural conversational delivery, accurate lip sync, realistic hand movements, subtle posture shifts, and authentic smartphone UGC framing. Natural skin texture, real phone lens look, messy real-life background details, no studio lighting, no perfect framing. Any product is held like a real object, its label faces the camera and stays readable. Maintain consistent hairstyle, outfit, room layout and lighting throughout.',
    negativePrompt:
      'plastic skin, extra fingers, warped jewelry or straps, fake logos, unreadable or warped text, sudden lighting changes, overly polished commercial movement, artificial expressions, wardrobe changes, face drift, fake stats or fake reviews, subtitles, watermarks',
    assistHintOverrides: {
      scenePrompt:
        'Decrit en anglais UNE video verticale 9:16 de 15 secondes, filmee au telephone, avec un seul decor et une seule tenue gardes identiques du debut a la fin. Structure en 4 temps avec horodatage, dans cet ordre : accroche (0-3 s), probleme ou decouverte du produit (3-7 s), preuve montree plutot que racontee (7-11 s), conclusion douce (11-15 s). Pour chaque temps, donne le type de plan (medium shot, close-up...), l angle, la focale equivalente et un mouvement de camera discret (poussee lente, derive laterale, rack focus, recul lent). Decris le produit concretement (forme, couleur, matiere) sans nom de marque invente. Aucun dialogue ni texte a l ecran dans cette description, pas de description du visage (il vient de la face ref ou est laisse libre).',
      scriptText:
        'Texte parle en francais, de 3 a 4 phrases courtes, 2,5 mots par seconde maximum (donc 30 a 37 mots au total pour 15 s), ton d une vraie personne qui parle a une amie : tutoiement, honnete, un peu desordonne. La premiere phrase doit arreter le scroll en moins de 2 secondes. Pas de mot de marque qu une vraie personne ne dirait pas, aucune statistique ni avis invente, pas de guillemets, pas de didascalie.',
    },
    statut: 'valide',
    limites: 'Valide en usage reel par l utilisateur (octobre 2026, fonctionne correctement). Passe par le widget Video Scenario car c est le seul a proposer Omni Flash (synchro labiale) : pas de packshot, le produit n est decrit qu en texte donc son etiquette peut deriver. Avec identite verrouillee, flux Omni Flash 2 tours (defauts connus de derive en debut/fin de clip) ; sans verrouillage, un script de plus de ~22 mots est enchaine en plusieurs segments.',
    source: 'tmp/autres/PROMPTS.md #78 (structure et paragraphe de jeu, sans le cas maillot de bain) + prompt "Opus 5.5 AI UGC Ad Director" (contraintes de realisme)',
  },
  {
    id: 'PORTRAIT_EDITORIAL_EXTERIEUR',
    nom: 'Portrait editorial en exterieur (golden hour, 85mm)',
    type: 'IMAGE',
    widgetId: 'PORTRAIT_STUDIO',
    tier: null,
    accountTypeRestriction: null,
    selectable: true,
    // Un seul pattern automatisable par widget dans ce lot : PORTRAIT_COZY_HOME.
    automatable: false,
    tags: ['portrait', 'editorial', 'exterieur', 'luxe', 'golden-hour'],
    template:
      'Ultra-photorealistic fashion editorial photograph of {{persona.description}}, {{cadrage}}, keeping the face and identity fully consistent with the reference. She wears {{tenue}}. Setting: {{decor}}, an outdoor location with strong character, real architectural details and lush natural greenery. {{lumiere}}, warm directional late-afternoon sunlight creating soft highlights on skin and hair and gentle shadows. Shot on a full-frame mirrorless camera with an 85mm f/1.4 lens, shallow depth of field, creamy bokeh in the background, ultra-sharp focus on the face, visible natural skin texture and pores, realistic fabric folds, filmic color grading, high dynamic range. {{style_photo}} aesthetic, {{aspect_ratio}} composition.',
    negativePrompt:
      'extra fingers, deformed hands, plastic skin, over-smoothed face, changed facial features, extra limbs, distorted proportions, watermark, text, logos, low resolution, cartoon, illustration',
    assistHintOverrides: {
      decor:
        'Un lieu exterieur precis et photogenique, en anglais, avec des elements d architecture reels et de la vegetation (cour mediterraneenne, rue de la Riviera, jardin d une propriete...). Pas de marque ni de logo cites.',
      lumiere:
        'Lumiere naturelle chaude et directionnelle de fin d apres-midi (golden hour), en anglais, une phrase.',
    },
    statut: 'experimental',
    limites: 'Jamais teste avec un vrai rendu Plotline. Fusion de trois recettes proches (cour mediterraneenne, rue de la Riviera, jardin de luxe) ; les marques et references de materiel citees dans les sources sont retirees.',
    source: 'tmp/autres/PROMPTS-INBOX.md #40, #43 (Cannes), #44 (luxe)',
  },
  {
    id: 'VLOG_DV_CAMCORDER',
    nom: 'Vlog camescope DV annees 2000',
    type: 'VIDEO',
    widgetId: 'VLOG_LIFESTYLE',
    tier: null,
    accountTypeRestriction: null,
    selectable: true,
    automatable: false,
    tags: ['video', 'vlog', 'dv', 'nostalgie', 'home-video'],
    template:
      'An ultra-realistic home-video {{type_vlog}} filmed by a friend on an early-2000s consumer DV camcorder. {{persona.description}} in {{decor}}. Imperfect handheld operation, natural camera shake, awkward framing, occasional reframing, autofocus hunting, slight lens breathing, exposure pumping between sunlight and shade, subtle motion blur, mild rolling shutter, faded colors, soft contrast, slight digital compression and sensor noise. No stabilization, no cinematic camera moves, no modern color grading. Everything must feel genuinely captured, not AI-generated. Timeline ({{duree}}s): {{sequence_scenes}}. {{dialogue_court}} Only authentic location sound, no music, no narration. Keep her face, hairstyle and clothing perfectly consistent throughout. The recording may end abruptly on black, like an old camcorder being switched off.',
    negativePrompt:
      'stabilization, cinematic camera moves, modern color grading, polished commercial look, identity change, text overlays, logos',
    assistHintOverrides: {
      sequence_scenes:
        'Enchainement des plans dans le temps avec horodatage (ex: 00:00-00:05), en anglais, banal et concret (une personne ordinaire dans un quotidien calme), un seul quartier, pas de commerce ni de foule, aucune action spectaculaire.',
    },
    statut: 'experimental',
    limites: 'Jamais teste avec un vrai rendu Plotline. Ce widget n envoie pas de texte parle a Omni Flash : la replique eventuelle reste dans le prompt (Veo/Kling), sans synchro labiale garantie.',
    source: 'tmp/autres/PROMPTS-INBOX.md #3 (variation 1 "same topic"), #36',
  },
  {
    id: 'PORTRAIT_POSE_CATALOGUE',
    nom: 'Portrait a poses (catalogue de poses)',
    type: 'IMAGE',
    widgetId: 'PORTRAIT_STUDIO',
    tier: 'B',
    accountTypeRestriction: 'INFLUENCER_CREATOR',
    // INACTIF : decision de l utilisateur (2026-10-05). Ne sera rendu
    // selectionnable qu apres le choix d un modele de generation plus
    // permissif, branche par l utilisateur lui-meme. Aucun template tant que
    // le widget n a pas de variable "pose" (voir server/data/poseCatalog.js).
    selectable: false,
    automatable: false,
    tags: ['portrait', 'poses', 'catalogue'],
    template: null,
    negativePrompt: null,
    assistHintOverrides: null,
    statut: 'reserve',
    limites: 'Donnees seulement (server/data/poseCatalog.js, 21 poses par nom de planche). Conditions au branchement : personas fictives adultes issues de la face ref, jamais le visage d une personne reelle ; ajouter une variable "pose" au widget ou un widget dedie.',
    source: 'zip pattern-images/ref-pose fourni le 2026-10-05 (hors depot)',
  },
];

export function getPromptPatterns() {
  return PROMPT_PATTERNS;
}

export function getPromptPatternById(id) {
  const key = String(id || '').trim().toUpperCase();
  return PROMPT_PATTERNS.find((pattern) => pattern.id === key) || null;
}
