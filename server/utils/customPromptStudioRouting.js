import { getWidgets } from '../data/widgets.js';
import { buildEffectiveWidget, getAutomatablePatternForWidget } from './promptPatternSelector.js';

/**
 * Choisit le widget Studio utilisable automatiquement par la cadence pour le
 * format CUSTOM_PROMPT_STUDIO (voir CLAUDE.md, decision du 2026-09-23).
 *
 * Champ volontairement restreint a deux widgets, chacun reutilisant un
 * pipeline deja eprouve avec de l argent reel plutot que d en risquer un
 * nouveau sans test :
 * - PORTRAIT_STUDIO (persona, IMAGE) : generation image classique, aucune
 *   ambiguite de modele video.
 * - SCENARIO_BLOG (pas de persona, VIDEO) : Omni Flash sans face ref, le
 *   chemin exact deja valide par `/api/external/video-jobs` et le widget
 *   Studio manuel.
 *
 * Explicitement exclus pour l instant :
 * - FOOD_AD / UGC_PRODUIT : exigent un asset uploade (packshot, photo
 *   reference), qu on n a pas a l approbation automatique d un plan.
 * - VLOG_LIFESTYLE : persona + Omni Flash deux tours, le seul chemin qui
 *   verrouille l identite ET fait parler -- connu pour deriver sur
 *   l identite et produire des artefacts de raccord (voir CLAUDE.md,
 *   decision du 2026-09-09). Pas encore eprouve en generation automatisee.
 */
const AUTOMATABLE_WIDGET_IDS = new Set(['PORTRAIT_STUDIO', 'SCENARIO_BLOG']);

function requiresUploadAsset(widget) {
  return (widget?.assetsRequis || []).some((asset) => asset?.source === 'upload');
}

export function chooseCustomPromptWidget(withFaceRef) {
  const widgets = getWidgets();

  return (
    widgets.find(
      (widget) => AUTOMATABLE_WIDGET_IDS.has(widget.id)
        && Boolean(widget.requiresPersona) === Boolean(withFaceRef)
        && !requiresUploadAsset(widget),
    ) || null
  );
}

/**
 * Meme choix que `chooseCustomPromptWidget`, mais renvoie aussi le pattern de
 * prompt actif pour ce widget (server/data/promptPatterns.js), fusionne dans
 * le widget final a utiliser. Un seul pattern automatisable par widget dans
 * ce lot (2026-09-24) : pas de selection par tag, voir CLAUDE.md.
 *
 * Si un widget est automatisable mais qu aucun pattern actif n existe pour
 * lui (ne devrait pas arriver avec les donnees actuelles), on retombe sur le
 * widget de base plutot que d echouer -- mieux vaut le template generique du
 * widget qu un contenu bloque.
 */
export function chooseCustomPromptWidgetAndPattern(withFaceRef) {
  const widget = chooseCustomPromptWidget(withFaceRef);
  if (!widget) return { widget: null, pattern: null };

  const pattern = getAutomatablePatternForWidget(widget.id);
  const effectiveWidget = pattern ? buildEffectiveWidget(widget, pattern) : widget;

  return { widget: effectiveWidget, pattern };
}
