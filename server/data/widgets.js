/**
 * Definitions des widgets Studio: blocs selectionnables qui pre-remplissent un
 * prompt de generation a partir d'un template. Config statique volontairement
 * (comme variables.json/promptTemplates.js): pas d'edition de template depuis
 * l'UI en V1, ajouter un widget = ajouter une entree ici, jamais de code
 * specifique a ce widget.
 *
 * Forme d'une variable: { key, source: 'input'|'persona', label?, type? }.
 * Forme d'un asset requis: { key, source: 'persona'|'upload', required }.
 */

export const WIDGETS = [
  {
    id: 'PORTRAIT_STUDIO',
    nom: 'Portrait Studio Persona',
    typeGeneration: ['IMAGE'],
    requiresPersona: true,
    template:
      'Create a photorealistic {{cadrage}} portrait of {{persona.description}}, wearing {{tenue}}, in a {{decor}} setting. {{lumiere}}. Natural skin texture, realistic pores, authentic proportions, no beautification, no identity change. {{style_photo}} aesthetic, {{aspect_ratio}} composition.',
    variables: [
      { key: 'cadrage', source: 'input', label: 'Cadrage', type: 'text' },
      { key: 'tenue', source: 'input', label: 'Tenue', type: 'text' },
      { key: 'decor', source: 'input', label: 'Decor', type: 'text' },
      { key: 'lumiere', source: 'input', label: 'Lumiere', type: 'text' },
      { key: 'style_photo', source: 'input', label: 'Style photo', type: 'text' },
      { key: 'aspect_ratio', source: 'input', label: 'Format (aspect ratio)', type: 'text' },
      { key: 'persona.description', source: 'persona' },
    ],
    assetsRequis: [{ key: 'personaFaceRef', source: 'persona', required: true }],
    negativePrompt: 'identity change, plastic skin, extra fingers, CGI appearance, text, watermark',
  },
  {
    id: 'VLOG_LIFESTYLE',
    nom: 'Vlog Lifestyle Handheld',
    typeGeneration: ['VIDEO'],
    requiresPersona: true,
    template:
      'An ultra-realistic handheld {{type_vlog}} video. {{persona.description}} in {{decor}}. Natural handheld camera movement, casual framing, imperfect human camera operation, authentic everyday atmosphere. No scripted acting, no artificial transitions, no identity changes, camera never visible. Timeline ({{duree}}s): {{sequence_scenes}}. {{dialogue_court}}',
    variables: [
      { key: 'type_vlog', source: 'input', label: 'Type de vlog', type: 'text' },
      { key: 'decor', source: 'input', label: 'Decor', type: 'text' },
      { key: 'duree', source: 'input', label: 'Duree (secondes)', type: 'number' },
      { key: 'sequence_scenes', source: 'input', label: 'Sequence des scenes', type: 'textarea' },
      { key: 'dialogue_court', source: 'input', label: 'Dialogue court', type: 'textarea' },
      { key: 'persona.description', source: 'persona' },
    ],
    assetsRequis: [{ key: 'personaFaceRef', source: 'persona', required: true }],
    negativePrompt: "camera visible, changement d'identité, transitions artificielles, pose scriptée",
  },
  {
    id: 'FOOD_AD',
    nom: 'Food Ad Local Language',
    typeGeneration: ['VIDEO'],
    requiresPersona: false,
    template:
      'Create a {{duree}}-second photorealistic {{cuisine}} commercial using {{image_reference}} as the exact reference for the cast, setting and food presentation. {{sequence_preparation}}. Dialogue in {{langue_locale}}: {{repliques}}. End with a hero shot of {{plat_final}}. Same characters, same setting, same food styling throughout, no identity drift, no logos, no subtitles.',
    variables: [
      { key: 'duree', source: 'input', label: 'Duree (secondes)', type: 'number' },
      { key: 'cuisine', source: 'input', label: 'Cuisine', type: 'text' },
      { key: 'sequence_preparation', source: 'input', label: 'Sequence de preparation', type: 'textarea' },
      { key: 'langue_locale', source: 'input', label: 'Langue locale', type: 'text' },
      { key: 'repliques', source: 'input', label: 'Repliques', type: 'textarea' },
      { key: 'plat_final', source: 'input', label: 'Plat final', type: 'text' },
      // La reference porte le nom de la variable du template (utilisee comme
      // start frame de la video, pas injectee comme texte dans le prompt).
      { key: 'image_reference', source: 'upload', label: 'Image de reference (cast + decor + plat)' },
    ],
    assetsRequis: [{ key: 'image_reference', source: 'upload', required: true }],
    negativePrompt: 'identity drift, plastic food, exaggerated steam, subtitles, watermark',
  },
  {
    id: 'UGC_PRODUIT',
    nom: 'UGC Post - Brand Product',
    typeGeneration: ['IMAGE', 'VIDEO'],
    requiresPersona: true,
    template:
      'Format 9:16 vertical, premium UGC x {{categorie_produit}} commercial. Use the uploaded product image as the exact reference: {{description_produit_lock}}. {{persona.description}} holds/applies {{produit}}, face partially visible for authentic UGC feel. Voiceover: {{texte_voix_off}}. Shots: hook -> texture/application -> hero product reveal -> CTA final.',
    variables: [
      { key: 'categorie_produit', source: 'input', label: 'Categorie produit', type: 'text' },
      { key: 'description_produit_lock', source: 'input', label: 'Description produit (lock)', type: 'textarea' },
      { key: 'produit', source: 'input', label: 'Produit', type: 'text' },
      { key: 'texte_voix_off', source: 'input', label: 'Texte voix off', type: 'textarea' },
      { key: 'persona.description', source: 'persona' },
    ],
    assetsRequis: [
      { key: 'personaFaceRef', source: 'persona', required: true },
      { key: 'packshot', source: 'upload', required: true, label: 'Packshot produit' },
    ],
    negativePrompt: 'distorted product, altered label, fake typography, plastic skin',
  },
];

export function getWidgets() {
  return WIDGETS;
}

export function getWidgetById(id) {
  const key = String(id || '').trim().toUpperCase();
  return WIDGETS.find((widget) => widget.id === key) || null;
}
