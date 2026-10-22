// Limites des fichiers joints a l assistant « idee -> prompt » du Studio.
// Le serveur (server/utils/promptAttachments.js) fait foi et revalide tout ;
// ces valeurs servent seulement a prevenir l utilisateur AVANT l envoi.
export const PROMPT_ATTACHMENT_LIMITS = {
  maxFiles: 4,
  maxImageBytes: 3 * 1024 * 1024,
  maxPdfBytes: 4 * 1024 * 1024,
  maxTextChars: 12000,
  maxTotalBytes: 8 * 1024 * 1024,
  // Un fichier brut plus gros que ca n est meme pas lu par le navigateur.
  maxRawBytes: 15 * 1024 * 1024,
  // Cote le plus long d une image apres reduction (au-dela, Claude la reduit lui-meme).
  imageMaxSide: 1568,
}

export function formatAttachmentSize(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} o`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} Ko`
  return `${(value / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}
