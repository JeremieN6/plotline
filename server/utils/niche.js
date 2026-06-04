export function splitNiches(value = '') {
  return [...new Set(
    String(value)
      .split(/[;,\n]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

export function normalizeNicheValue(value = '') {
  return splitNiches(value).join(', ');
}