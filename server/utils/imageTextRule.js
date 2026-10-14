/**
 * Regle du texte dans les images generees (pur), partagee par les assistants "idee -> prompt" qui ecrivent des
 * prompts d IMAGE (prompt libre image, slides de carrousel).
 *
 * Decision du 2026-10-14 : on privilegie TOUJOURS l image sans texte. Du texte n est ajoute que si le besoin le
 * demande explicitement, et il est alors ecrit dans la langue demandee. Avant, la regle etait "jamais de texte" :
 * une demande explicite ("ecris le titre en francais") etait ignoree par le generateur.
 */
export const IMAGE_TEXT_RULE_LINES = [
  '- Par defaut l image ne contient AUCUN texte : on privilegie toujours l image sans texte, ajoute "no text" au prompt.',
  '- Ajoute du texte dans une image UNIQUEMENT si le besoin le demande explicitement (ex : "ecris le titre sur l image", "avec le texte en francais", un texte precis a afficher). Dans ce cas, mets dans le prompt de cette image le texte EXACT a afficher entre guillemets, court (quelques mots), avec sa place (ex : headline in the top third reading "Ma routine du matin"), dans la langue demandee (francais si le besoin est ecrit en francais et ne dit rien d autre), et n ecris pas "no text" pour cette image.',
  '- Une consigne de langue du texte sans demande de texte (ex : "ecris le texte en francais si tu en mets") ne justifie PAS d en ajouter : sans texte demande, l image reste sans texte.',
  '- Pas de watermark, pas de faux logo.',
];
