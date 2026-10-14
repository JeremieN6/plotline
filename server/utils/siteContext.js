import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Contexte d une marque tire de son site (page d accueil), donne a Claude pour ses slides et ses legendes.
 *
 * Claude (API) ne navigue pas : le serveur recupere la page, en extrait le texte utile (titre, description,
 * intertitres, paragraphes) et le tronque. Seule l adresse du site enregistree sur le PROFIL de la marque est lue,
 * jamais une adresse tapee librement dans une requete. Garde-fous contre le SSRF (un profil dont le site pointe
 * vers le reseau interne ne doit pas faire sonder ce reseau par le serveur) : http(s) seulement, ports 80/443,
 * pas d identifiants ni d adresse IP litterale, resolution DNS puis refus de toute adresse privee / locale a chaque
 * etape (redirections suivies a la main, 3 au plus), delai et taille bornes, HTML uniquement. Ne leve jamais :
 * toute erreur donne '' et la generation se fait sans contexte de site.
 */

export const SITE_CONTEXT_MAX_CHARS = 2500;
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

/** Adresse IP privee, locale, reservee ou invalide (pur). Tout ce qui n est pas une IP publique reconnue est refuse. */
export function isPrivateAddress(ip) {
  const value = String(ip || '').trim().toLowerCase();
  if (!value) return true;

  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (mapped) return isPrivateAddress(mapped[1]);

  if (net.isIPv4(value)) {
    const [a, b] = value.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && (b === 168 || value.startsWith('192.0.0.'))) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    return a >= 224;
  }

  if (net.isIPv6(value)) {
    if (value === '::' || value === '::1') return true;
    if (/^f[cd]/.test(value)) return true;
    return /^fe[89ab]/.test(value);
  }

  return true;
}

/** Adresse de site acceptable (pur) : renvoie l URL, ou null. */
export function parseSiteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (url.username || url.password) return null;
  if (url.port && !['80', '443'].includes(url.port)) return null;

  const host = url.hostname.toLowerCase();
  if (!host.includes('.')) return null;
  if (net.isIP(host.replace(/^\[|\]$/g, ''))) return null;
  if (host === 'localhost' || /\.(local|localhost|internal|lan|home|corp|intranet)$/.test(host)) return null;
  return url;
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', hellip: '…', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', agrave: 'à', ecirc: 'ê', ccedil: 'ç' };

function decodeEntities(text) {
  return String(text || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Math.min(Number(code), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Math.min(parseInt(code, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function stripTags(html) {
  return decodeEntities(String(html || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function metaContent(html, names) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = /(?:name|property)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (!key || !names.includes(key)) continue;
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    const value = decodeEntities(content?.[1] ?? content?.[2] ?? '').replace(/\s+/g, ' ').trim();
    if (value) return value;
  }
  return '';
}

/**
 * Texte utile d une page HTML (pur) : titre, description, intertitres, paragraphes et elements de liste.
 * Les scripts, styles et blocs non textuels sont retires. Tronque a `maxChars`.
 */
export function extractSiteText(html, { maxChars = SITE_CONTEXT_MAX_CHARS } = {}) {
  const source = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, (match, name) => (name.toLowerCase() === 'head' ? match : ' '));

  const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(source)?.[1] || '');
  const description = metaContent(source, ['description', 'og:description']);

  const body = source.replace(/<head\b[\s\S]*?<\/head>/i, ' ');
  const headings = [];
  for (const match of body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
    const text = stripTags(match[1]);
    if (text && text.length <= 160 && !headings.includes(text)) headings.push(text);
    if (headings.length >= 14) break;
  }

  const paragraphs = [];
  for (const match of body.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = stripTags(match[2]);
    if (text.length >= 25 && !paragraphs.includes(text)) paragraphs.push(text);
    if (paragraphs.length >= 40) break;
  }

  const sections = [];
  if (title) sections.push(`Titre : ${title}`);
  if (description && description !== title) sections.push(`Description : ${description}`);
  if (headings.length) sections.push(`Intertitres : ${headings.join(' | ')}`);
  if (paragraphs.length) sections.push(`Texte : ${paragraphs.join(' ')}`);

  const text = sections.join('\n');
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text;
}

async function defaultLookup(hostname, options) {
  return dns.lookup(hostname, options);
}

async function isPublicHost(hostname, lookup) {
  try {
    const addresses = await lookup(hostname, { all: true });
    const list = (Array.isArray(addresses) ? addresses : [addresses]).map((item) => item?.address ?? item);
    return list.length > 0 && list.every((address) => !isPrivateAddress(address));
  } catch {
    return false;
  }
}

async function readLimited(response, maxBytes) {
  if (!response.body?.getReader) {
    return String(await response.text()).slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).subarray(0, maxBytes));
}

/**
 * Recupere le texte utile du site (jamais d exception : '' en cas de refus, d erreur ou de page sans texte).
 * `fetchImpl` et `lookup` sont injectables pour les tests.
 */
export async function fetchSiteContext(rawUrl, {
  fetchImpl = globalThis.fetch,
  lookup = defaultLookup,
  timeoutMs = FETCH_TIMEOUT_MS,
  maxBytes = MAX_BYTES,
  maxChars = SITE_CONTEXT_MAX_CHARS,
} = {}) {
  let url = parseSiteUrl(rawUrl);
  if (!url || typeof fetchImpl !== 'function') return '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!(await isPublicHost(url.hostname, lookup))) return '';

      const response = await fetchImpl(url.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'PlotlineBot/1.0 (contexte de marque)', accept: 'text/html,application/xhtml+xml' },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers?.get?.('location');
        if (!location) return '';
        url = parseSiteUrl(new URL(location, url).toString());
        if (!url) return '';
        continue;
      }

      if (!response.ok) return '';
      const type = response.headers?.get?.('content-type') || '';
      if (!/text\/html|application\/xhtml/i.test(type)) return '';

      return extractSiteText(await readLimited(response, maxBytes), { maxChars });
    }
    return '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

const cache = new Map();

/** Contexte du site avec cache en memoire (6 h ; 10 min si rien n a pu etre lu). */
export async function getSiteContext(rawUrl, options = {}) {
  const url = parseSiteUrl(rawUrl);
  if (!url) return '';

  const key = url.toString();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;

  const value = await fetchSiteContext(key, options);
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: now + (value ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS) });
  return value;
}

export function clearSiteContextCache() {
  cache.clear();
}
