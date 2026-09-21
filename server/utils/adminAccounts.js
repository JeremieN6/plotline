/**
 * Comptes administrateurs, declares dans la variable d environnement
 * ADMIN_ACCOUNTS (emails separes par des virgules). Aucune colonne en base:
 * la liste vit hors du depot, et changer d admin ne demande aucune migration.
 */

export function parseAdminAccounts(raw) {
  return String(raw || '')
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email, raw = process.env.ADMIN_ACCOUNTS) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return false;
  return parseAdminAccounts(raw).includes(normalized);
}
