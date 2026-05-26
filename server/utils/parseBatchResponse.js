function cleanMarkdownJson(rawString) {
  if (typeof rawString !== 'string') {
    return '';
  }

  return rawString
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function assertKey(obj, key) {
  if (!(key in obj)) {
    throw new Error(`Missing key: ${key}`);
  }
}

export function parseBatchResponse(rawString) {
  const cleaned = cleanMarkdownJson(rawString);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_error) {
    const preview = String(rawString || '').slice(0, 500);
    console.error('[parseBatchResponse] Invalid JSON from Claude (preview):', preview);
    throw new Error('Claude returned invalid JSON');
  }

  assertKey(parsed, 'batchSummary');
  assertKey(parsed, 'posts');
  assertKey(parsed, 'memoryUpdate');

  if (!Array.isArray(parsed.posts) || parsed.posts.length === 0) {
    throw new Error('posts must be a non-empty array');
  }

  return parsed;
}
