// Champs d une scene faceless que l editeur de plan doit montrer, selon la mise en page ET le modele visuel.
// Source : ce que chaque moteur de rendu lit reellement (server/utils/facelessTemplate*.js) et ce que le
// serveur exige (sanitizeFacelessScene : une mise en page sans son champ obligatoire retombe sur « avatar »).

export const LAYOUT_LABELS = {
  hook: 'Accroche (gros titre)',
  title: 'Phrase / chapitre',
  list: 'Liste',
  avatar: 'Avatar / appel à l’action',
  word: 'Mot géant',
  stat: 'Chiffre clé',
  photo: 'Photo',
  slideshow: 'Défilé d’images',
  logo: 'Logo',
  label: 'Étiquette de produit',
}

// Champ principal de chaque mise en page (modele classique et par defaut).
const BASE = {
  hook: [{ key: 'text', label: 'Phrase d’accroche', required: true, max: 110, hint: '**mot** = mis en avant' }],
  title: [
    { key: 'title', label: 'Gros titre', required: true, max: 40 },
    { key: 'text', label: 'Carte sous le titre', max: 110 },
  ],
  list: [{ key: 'title', label: 'Titre de la liste', max: 40 }],
  avatar: [{ key: 'text', label: 'Phrase affichée', max: 110, hint: '**mot** = mis en avant' }],
  word: [{ key: 'word', label: 'Le mot en grand', required: true, max: 30, hint: 'Un mot ou un court groupe de mots : plus il est long, plus il s’affiche petit.' }],
  stat: [
    { key: 'word', label: 'Le chiffre', required: true, max: 14, hint: 'Ex. 70 %' },
    { key: 'text', label: 'Phrase de contexte', max: 110 },
  ],
  photo: [{ key: 'text', label: 'Légende de l’image', max: 110 }],
  slideshow: [{ key: 'text', label: 'Légende (facultative)', max: 110 }],
  logo: [{ key: 'word', label: 'Nom à afficher', required: true, max: 14 }],
  label: [{ key: 'text', label: 'Verdict (ligne du bas)', max: 110 }],
}

// Champs en plus du mot geant, selon le modele (libelle au-dessus, phrase de soutien...).
const WORD_EXTRAS = {
  dashboard: [{ key: 'title', label: 'Libellé au-dessus du mot', max: 40, hint: 'Vide : « À retenir ».' }],
  herbier: [
    { key: 'title', label: 'Libellé au-dessus du mot', max: 40, hint: 'Vide : « Ingrédient ».' },
    { key: 'text', label: 'Nom latin, tapé sous le mot', max: 110 },
  ],
  hanko: [{ key: 'title', label: 'Libellé au-dessus du mot', max: 40 }],
  journal: [
    { key: 'title', label: 'Libellé au-dessus du mot', max: 40 },
    { key: 'text', label: 'Phrase de soutien sous le mot', max: 110 },
  ],
  cahier: [{ key: 'text', label: 'Phrase d’introduction au-dessus du mot', max: 110 }],
  editeur: [{ key: 'text', label: 'Phrase sous le terminal', max: 110 }],
};

// Modeles dont l accroche et le chapitre affichent le champ « title » comme petit libelle AU-DESSUS de la phrase.
const KICKER_TEMPLATES = ['herbier', 'journal', 'fenetre', 'dashboard']

// Onglet / libelle court (champ « tab ») : ou il sert, et a quoi.
const TAB_LAYOUTS = {
  fenetre: ['hook', 'title', 'list', 'word', 'stat', 'avatar', 'photo', 'logo'],
  editeur: ['hook', 'list', 'photo', 'stat', 'title'],
  brutal: ['hook'],
  dashboard: ['hook', 'title', 'photo'],
  hanko: ['hook', 'photo'],
  journal: ['list', 'photo', 'title'],
  herbier: ['hook'],
}
const TAB_LABELS = {
  fenetre: 'Onglet de la fenêtre',
  editeur: 'Onglet de l’éditeur (nom de fichier)',
  brutal: 'Légende en bas de l’affiche',
  dashboard: { hook: 'Pastille de statut', title: 'Notification', photo: 'Adresse de la fenêtre (cadre d’écran)' },
  hanko: { hook: 'Légende', photo: 'Note en tampon' },
  journal: { list: 'Libellé', photo: 'Adresse de la capture', title: 'Notification' },
  herbier: 'Libellé du haut',
}

const ITEM_SUB_LABELS = {
  dashboard: 'Sous-ligne',
  hanko: 'Lettre du classement (S, A, B, C)',
  herbier: 'Mot du verdict',
  journal: 'Précision',
}
const TONE_TEMPLATES = ['herbier', 'journal']

// Emoji d'une scene : autocollant du modele classique (accroche, chapitre, mot, logo) ; icone du logo pour Cahier, Dashboard et Fenetre.
const LOGO_EMOJI_TEMPLATES = ['cahier', 'dashboard', 'fenetre']
export function sceneEmoji(template, kind) {
  if (template === 'classic') return ['hook', 'title', 'word', 'logo'].includes(kind)
  return kind === 'logo' && LOGO_EMOJI_TEMPLATES.includes(template)
}

export function tabLabel(template, layout) {
  const entry = TAB_LABELS[template]
  if (!entry) return 'Libellé court'
  return typeof entry === 'string' ? entry : entry[layout] || 'Libellé court'
}

/**
 * Pur : ce que l editeur doit montrer pour une scene.
 * Renvoie { fields, tab, jp, code, items, compare, series, emoji }.
 *  - fields : champs texte principaux (cle, libelle, obligatoire, longueur max)
 *  - tab / jp / code : champs propres a certains modeles (null si inutiles ici)
 *  - items / compare / series : editeurs de lignes (null si inutiles ici)
 */
export function sceneFieldsFor(layout, template = 'classic') {
  const kind = BASE[layout] ? layout : 'avatar'
  let fields = BASE[kind].map((field) => ({ ...field }))

  if (kind === 'hook' && KICKER_TEMPLATES.includes(template)) {
    fields = [
      { key: 'title', label: 'Petit libellé au-dessus', max: 40 },
      { key: 'text', label: 'Phrase d’accroche', required: true, max: 110, hint: '**mot** = mis en avant' },
    ]
  }
  if (kind === 'title' && template !== 'classic') {
    fields = [
      { key: 'title', label: KICKER_TEMPLATES.includes(template) ? 'Petit libellé au-dessus' : 'Titre court', required: true, max: 40 },
      { key: 'text', label: 'Phrase affichée', max: 110, hint: '**mot** = mis en avant' },
    ]
  }

  if (kind === 'word') fields = [...fields, ...(WORD_EXTRAS[template] || []).map((field) => ({ ...field }))]

  const tabOk = (TAB_LAYOUTS[template] || []).includes(kind)
  const items = kind === 'list' || kind === 'label'
    ? {
        max: kind === 'label' ? 8 : 4,
        min: 2,
        subLabel: ITEM_SUB_LABELS[template] || '',
        tone: TONE_TEMPLATES.includes(template),
        // L'emoji d'un element n'est dessine que par le modele classique (les autres ont leurs propres icones).
        emoji: template === 'classic' && kind === 'list',
      }
    : null
  const compare = kind === 'stat' || (kind === 'hook' && template === 'dashboard') ? { max: 3 } : null

  return {
    kind,
    fields,
    tab: tabOk ? { label: tabLabel(template, kind), max: 24 } : null,
    jp: template === 'hanko' && (kind === 'hook' || kind === 'word') ? { label: 'Caractères japonais (1 à 4)', max: 4 } : null,
    code: template === 'editeur' && (kind === 'hook' || kind === 'title') ? { label: 'Code affiché (une ligne par ligne, 32 caractères max)', max: 6 } : null,
    items,
    slideshow: kind === 'slideshow' ? { max: 5, min: 2 } : null,
    // Type de la notification (champ `tabTone`) : seul le modele Dashboard en dessine une, sur un chapitre.
    toast: template === 'dashboard' && kind === 'title',
    compare,
    series: template === 'dashboard' && kind === 'stat' ? { max: 8 } : null,
    emoji: sceneEmoji(template, kind),
  }
}

/** Pur : texte d avertissement si la scene va retomber sur « avatar » au rendu (comme le fait le serveur). */
export function incompleteReason(scene, template = 'classic') {
  const layout = scene?.layout
  const spec = sceneFieldsFor(layout, template)
  const has = (key) => Boolean(String(scene?.[key] || '').trim())

  if (layout === 'list' || layout === 'label') {
    const filled = (scene.items || []).filter((item) => String(item?.text || '').trim()).length
    return filled < 2 ? 'Il faut au moins 2 éléments, sinon la scène s’affichera comme « Avatar ».' : ''
  }
  if (layout === 'slideshow') return (scene.images || []).length < 2 ? 'Choisis au moins 2 images, sinon la scène s’affichera comme « Avatar » (une seule image = une scène Photo).' : ''
  if (layout === 'photo') return scene.image || scene.newImage ? '' : 'Choisis une image, sinon la scène s’affichera comme « Avatar ».'
  for (const field of spec.fields) {
    if (field.required && !has(field.key)) {
      return `Sans « ${field.label.toLowerCase()} », la scène s’affichera comme « Avatar ».`
    }
  }
  return ''
}

const normalizeWord = (word) => String(word || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/^(?:qu|[cdjlmnst])['’]/, '')
  .replace(/[^a-z0-9]+/g, '')

/**
 * Pur : le repere d un element (mot dit qui le declenche) se trouve-t-il dans ce que dit la scene ?
 * Un repere vide ou numerique est considere valable ; sinon le serveur placerait l element au hasard de la phrase.
 */
export function cueIsSpoken(say, cue) {
  if (typeof cue === 'number') return true
  const wanted = String(cue ?? '').split(/\s+/).map(normalizeWord).filter(Boolean)
  if (!wanted.length) return true
  const spoken = String(say || '').replace(/\[[^\]\n]{1,24}\]/g, ' ').split(/\s+/).map(normalizeWord).filter(Boolean)
  for (let i = 0; i + wanted.length <= spoken.length; i += 1) {
    if (wanted.every((w, k) => spoken[i + k] === w)) return true
  }
  return false
}
