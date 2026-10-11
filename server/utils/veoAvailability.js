/**
 * Disponibilite de Veo (pur).
 *
 * Google retire de l API Gemini le 22 octobre 2026 les modeles
 * `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview` et
 * `veo-3.1-lite-generate-preview` (mail "[Deprecation] Migrate to
 * gemini-omni-1.1-flash by October 22, 2026"). Les versions `-001` ne sont plus
 * proposees que par la "Gemini Enterprise Agent Platform", une autre integration
 * (autre acces) que la cle Gemini utilisee ici. Seul `veo-3.1-generate-preview`
 * a jamais servi sur ce projet (4 generations, derniere le 2026-09-22).
 *
 * Apres cette date Veo est donc retire AUTOMATIQUEMENT : plus propose dans le
 * studio, jamais choisi par "Automatique" (Kling le remplace), et une demande
 * explicite recoit un refus clair au lieu d une erreur du fournisseur.
 *
 * `VEO_ENABLED=true` le reactive (par exemple apres une migration vers la
 * plateforme entreprise), `VEO_ENABLED=false` le coupe avant la date.
 */

export const VEO_PREVIEW_SUNSET = '2026-10-22T00:00:00Z';

export const VEO_RETIRED_MESSAGE = 'Veo n est plus disponible : Google a retire ses modeles preview le 22 octobre 2026. Choisissez Kling (ou Omni Flash pour une video parlee).';

export function isVeoEnabled(env = process.env, now = new Date()) {
  const raw = String(env?.VEO_ENABLED ?? '').trim().toLowerCase();
  if (['true', '1', 'yes'].includes(raw)) return true;
  if (['false', '0', 'no'].includes(raw)) return false;
  return now.getTime() < Date.parse(VEO_PREVIEW_SUNSET);
}
