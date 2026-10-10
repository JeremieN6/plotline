import { normalizePersonality } from './personality.js';

/**
 * Pont personnalite -> prompts (pur). Transforme la personnalite stockee d un
 * profil en un court bloc de texte que d autres fonctions (video faceless, puis
 * peut-etre captions et idees) injectent dans leurs prompts.
 *
 * Choix volontaires :
 *  - voix + ligne editoriale seulement (ton, tics, mots interdits, humour,
 *    adresse, piliers, promesse, lignes rouges). Pas de biographie ni de
 *    croyances par defaut : elles allongent le prompt sans changer le script ;
 *  - borne en longueur : si le bloc depasse `maxChars`, les lignes les moins
 *    importantes sautent d abord (jamais une ligne coupee en deux) ;
 *  - une personnalite absente, vide ou invalide donne '' (aucun effet) ;
 *  - le contenu est normalise avant usage (jamais pris tel quel de la base).
 */

// ~400 tokens au plus par appel. 1 100 faisait sauter les lignes editoriales (lignes rouges
// comprises) sur une personnalite reelle bien remplie.
const DEFAULT_MAX_CHARS = 1600;
const HEADER = 'Personnalité détaillée (prioritaire sur le style ci-dessus en cas de contradiction) :';

// `priority` : plus le chiffre est petit, plus la ligne est importante (elle saute en dernier).
const LINES = [
  { label: 'Ton', block: 'voice', key: 'tone', type: 'text', priority: 1 },
  { label: 'Longueur des phrases', block: 'voice', key: 'sentenceLength', type: 'text', priority: 6 },
  { label: 'Humour', block: 'voice', key: 'humor', type: 'text', priority: 7 },
  { label: 'Adresse au public', block: 'voice', key: 'address', type: 'text', priority: 2 },
  { label: 'Façon de nommer son audience', block: 'voice', key: 'audienceName', type: 'text', priority: 8 },
  { label: 'Tics de langage (à utiliser avec parcimonie)', block: 'voice', key: 'verbalTics', type: 'list', priority: 5 },
  { label: 'Mots à NE JAMAIS employer', block: 'voice', key: 'bannedWords', type: 'list', priority: 3 },
  // Les lignes rouges sont des interdits : elles passent avant les piliers et la promesse.
  { label: 'À éviter absolument', block: 'editorial', key: 'redLines', type: 'list', priority: 4 },
  { label: 'Piliers de contenu', block: 'editorial', key: 'contentPillars', type: 'list', priority: 9 },
  { label: 'Promesse faite à l audience', block: 'editorial', key: 'promise', type: 'text', priority: 10 },
];

function oneLine(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * @param {unknown} personality personnalite stockee (objet ou texte JSON)
 * @param {{ maxChars?: number }} [options]
 * @returns {string} bloc de texte, ou '' s il n y a rien d utile
 */
export function buildPersonalityBrief(personality, { maxChars = DEFAULT_MAX_CHARS } = {}) {
  if (!personality) return '';
  const normalized = normalizePersonality(personality);

  const entries = [];
  for (const line of LINES) {
    const value = normalized.blocks?.[line.block]?.[line.key]?.value;
    const text = line.type === 'list'
      ? (Array.isArray(value) ? value.map((item) => oneLine(item, 60)).filter(Boolean).slice(0, 6).join(', ') : '')
      : (typeof value === 'string' ? oneLine(value, 220) : '');
    if (text) entries.push({ ...line, text: `${line.label} : ${text}` });
  }
  if (!entries.length) return '';

  const render = () => [HEADER, ...entries.map((entry) => entry.text)].join('\n');
  while (entries.length && render().length > maxChars) {
    const lowest = entries.reduce((worst, entry) => (entry.priority > worst.priority ? entry : worst), entries[0]);
    entries.splice(entries.indexOf(lowest), 1);
  }
  return entries.length ? render() : '';
}
