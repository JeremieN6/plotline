/**
 * Regles d ecriture communes aux textes ecrits par Claude (decision de l utilisateur, 2026-10-15) :
 *  1. jamais de tiret comme ponctuation (cadratin, demi-cadratin, " - ") : une virgule a la place ;
 *  2. chiffres, dates, montants, pourcentages : en CHIFFRES, jamais en lettres.
 * La regle 1 est aussi APPLIQUEE par le code (Claude en met quand meme) ; la regle 2 ne peut etre
 * demandee que dans le prompt (convertir des nombres ecrits en lettres par code serait risque).
 * Les mots composes avec trait d union (vingt-deux, c est-a-dire, abonne-toi) ne sont pas touches.
 */

/** Pur : texte sans tiret de ponctuation ; les sauts de ligne sont conserves. */
export function stripDashPunctuation(value) {
  return String(value ?? '')
    // Puces "- " en debut de ligne : retirees.
    .replace(/^[ \t]*[-–—]\s+/gm, '')
    // Cadratin / demi-cadratin (avec ou sans espaces) et tiret isole entre espaces : virgule.
    .replace(/[ \t]*[—–―‒][ \t]*/g, ', ')
    .replace(/[ \t]+-[ \t]+/g, ', ')
    // Menage : virgules doublees, virgule apres une ponctuation forte ou avant une ponctuation, virgule finale.
    .replace(/,(?:[ \t]*,)+/g, ',')
    .replace(/([.!?…:;])[ \t]*,[ \t]*/g, '$1 ')
    .replace(/[ \t]*,[ \t]*([.!?…:;])/g, '$1')
    .replace(/^[ \t]*,[ \t]*/gm, '')
    .replace(/,[ \t]*$/gm, '')
    .replace(/[ \t]{2,}/g, ' ');
}

/** Consignes de prompt (a ajouter aux prompts qui ecrivent du texte publie ou dit). */
export const TEXT_STYLE_PROMPT_LINES = [
  '- Chiffres, dates, montants, pourcentages, durees : TOUJOURS en chiffres (22 leads, 11 %, 15 octobre, 3 jours, 1/3), jamais en lettres.',
  '- N utilise JAMAIS de tiret comme ponctuation : ni "—", ni "–", ni " - " entre deux phrases ou deux idees. Mets une virgule ou un point. Les mots composes avec trait d union (vingt-deux, c est-a-dire, abonne-toi) restent normaux.',
];
