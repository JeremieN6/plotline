/**
 * Reglage « Video faceless des plans » d un profil : comment les REEL produits par le calendrier
 * (approbation d un plan editorial) sont fabriques. Stocke dans la DA principale du profil
 * (`facelessStyle.reelSettings`, aucune colonne en plus) ; tout est pur.
 *
 * - durationSeconds : duree visee (20, 30, 45 ou 60 s, comme `/studio/faceless`) ;
 * - styleSlot : DA utilisee (0 = principale, 1 et 2 = les options) ;
 * - stability : expressivite de la voix CLONEE (v3) : creative = forte, natural, robust = sobre.
 *   Sans effet avec une voix de synthese.
 */

export const REEL_DURATIONS = [20, 30, 45, 60];
export const REEL_STABILITIES = ['creative', 'natural', 'robust'];
export const DEFAULT_REEL_SETTINGS = { durationSeconds: 30, styleSlot: 0, stability: 'natural' };

const STABILITY_LABELS = { creative: 'forte', natural: 'naturelle', robust: 'sobre' };

/** Pur : reglage complet et sur (toute valeur inconnue retombe sur le defaut). */
export function normalizeReelSettings(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const duration = Number.parseInt(String(input.durationSeconds ?? ''), 10);
  const slot = Number.parseInt(String(input.styleSlot ?? ''), 10);
  return {
    durationSeconds: REEL_DURATIONS.includes(duration) ? duration : DEFAULT_REEL_SETTINGS.durationSeconds,
    styleSlot: Number.isInteger(slot) && slot >= 0 && slot <= 2 ? slot : DEFAULT_REEL_SETTINGS.styleSlot,
    stability: REEL_STABILITIES.includes(input.stability) ? input.stability : DEFAULT_REEL_SETTINGS.stability,
  };
}

/**
 * Pur : une ligne qui dit exactement comment le Reel sera produit.
 * `style` = la DA reellement utilisee (deja choisie par rang), `cloneVoice` = { name } ou null.
 */
export function describeReelSettings(settings, { style = null, cloneVoice = null } = {}) {
  const value = normalizeReelSettings(settings);
  const parts = ['Vidéo faceless', `${value.durationSeconds} s`];
  if (style?.name) parts.push(`DA ${style.name}`);
  if (cloneVoice) parts.push(`voix ${cloneVoice.name || 'clonée'}`, `expressivité ${STABILITY_LABELS[value.stability]}`);
  else parts.push('voix de synthèse');
  return parts.join(' · ');
}
