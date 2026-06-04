export function splitNiches(value = '') {
  return [...new Set(
    String(value)
      .split(/[;,\n]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )]
}

export function summarizeNiches(value = '') {
  const items = splitNiches(value)

  if (!items.length) {
    return ''
  }

  if (items.length === 1) {
    return items[0]
  }

  return `${items.length} niches`
}