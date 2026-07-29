export const ACCOUNT_TYPES = Object.freeze([
  'INFLUENCER_CREATOR',
  'CONTENT_CREATOR',
  'BRAND',
]);

const ACCOUNT_TYPE_SET = new Set(ACCOUNT_TYPES);

export function normalizeAccountType(value) {
  return String(value || '').trim().toUpperCase();
}

export function isAccountType(value) {
  return ACCOUNT_TYPE_SET.has(normalizeAccountType(value));
}
