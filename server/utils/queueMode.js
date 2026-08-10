/**
 * Mode de traitement des generations: file BullMQ ou execution directe.
 *
 * La meme fonction etait recopiee a l identique dans quatre endpoints, alors que
 * la convention du projet veut que la logique serveur vive dans server/utils.
 */
export function shouldUseQueue() {
  const rawValue = String(process.env.USE_QUEUE || '').trim().toLowerCase();
  return ['true', '1', 'yes'].includes(rawValue);
}
