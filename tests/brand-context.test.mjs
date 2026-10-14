import test from 'node:test';
import assert from 'node:assert/strict';

import { BRAND_ASSIST_RULE } from '../server/utils/brandAssistRule.js';
import {
  buildBrandCaptionSystemPrompt,
  buildBrandCaptionUserPrompt,
  formatBrandCaption,
  normalizeHashtags,
  parseBrandCaption,
} from '../server/utils/brandCaption.js';
import { buildBrandContextBlock, loadBrandContext } from '../server/utils/brandContext.js';
import { buildCarouselAssistSystemPrompt } from '../server/utils/carouselAssistGenerator.js';
import { buildPromptAssistSystemPrompt } from '../server/utils/promptAssistGenerator.js';
import {
  clearSiteContextCache,
  extractSiteText,
  fetchSiteContext,
  getSiteContext,
  isPrivateAddress,
  parseSiteUrl,
} from '../server/utils/siteContext.js';

const HTML = `<!doctype html><html><head><title>Skinalyze &amp; vous</title>
<meta name="description" content="Diagnostic peau en 60 secondes">
<script>var secret = "ne pas lire";</script><style>.a{color:red}</style></head>
<body><nav><li>Menu</li></nav><h1>Votre peau, analysée</h1><h2>Comment ça marche ?</h2>
<p>En 60 secondes, chaque client repart avec un diagnostic peau personnalisé, co-analysé par un dermatologue.</p>
<p>Court.</p><ul><li>Sans installation, sans engagement pour votre institut.</li></ul>
<script>alert('x')</script><noscript>activez js</noscript></body></html>`;

const okResponse = (html, { type = 'text/html; charset=utf-8', status = 200, headers = {} } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => ({ 'content-type': type, ...headers })[name.toLowerCase()] ?? null },
  text: async () => html,
  body: null,
});

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

test('adresses : privees, locales et reservees refusees ; publiques acceptees', () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.1', '192.168.1.10', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1', '224.0.0.1', '', 'pas une ip']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test('adresse de site : https/http, ports standards, sans identifiants ni IP litterale ni nom interne', () => {
  assert.equal(parseSiteUrl('https://skinalyze.sassify.fr/').hostname, 'skinalyze.sassify.fr');
  assert.equal(parseSiteUrl('skinalyze.sassify.fr').protocol, 'https:');
  assert.equal(parseSiteUrl('http://exemple.fr:80/a').port, '');
  for (const bad of ['', 'ftp://exemple.fr', 'javascript:alert(1)', 'http://127.0.0.1/', 'http://[::1]/', 'http://localhost/', 'http://intranet', 'http://serveur.local/', 'http://exemple.fr:8080/', 'https://user:mdp@exemple.fr/', 'http://169.254.169.254/latest', null]) {
    assert.equal(parseSiteUrl(bad), null, String(bad));
  }
});

test('texte du site : titre, description, intertitres, paragraphes ; scripts, styles et courts fragments ecartes', () => {
  const text = extractSiteText(HTML);
  assert.match(text, /Titre : Skinalyze & vous/);
  assert.match(text, /Description : Diagnostic peau en 60 secondes/);
  assert.match(text, /Intertitres : Votre peau, analysée \| Comment ça marche \?/);
  assert.match(text, /diagnostic peau personnalisé/);
  assert.match(text, /Sans installation, sans engagement/);
  assert.ok(!/secret|alert|activez js|color:red/.test(text));
  assert.ok(!/Texte : .*Court\./.test(text), 'les fragments de moins de 25 caracteres sont ecartes');
  assert.equal(extractSiteText(''), '');
  assert.ok(extractSiteText(`<p>${'mot '.repeat(2000)}</p>`, { maxChars: 300 }).length <= 300);
});

test('lecture du site : page recuperee, puis tous les refus renvoient une chaine vide sans exception', async () => {
  const ok = await fetchSiteContext('https://skinalyze.sassify.fr/', { fetchImpl: async () => okResponse(HTML), lookup: publicLookup });
  assert.match(ok, /Votre peau, analysée/);

  const privateLookup = async () => [{ address: '10.0.0.8', family: 4 }];
  let called = false;
  const spy = async () => { called = true; return okResponse(HTML); };
  assert.equal(await fetchSiteContext('https://interne.exemple.fr/', { fetchImpl: spy, lookup: privateLookup }), '');
  assert.equal(called, false, 'aucune requete n est envoyee vers une adresse privee');
  assert.equal(await fetchSiteContext('https://x.exemple.fr/', { fetchImpl: spy, lookup: async () => { throw new Error('ENOTFOUND'); } }), '');
  assert.equal(await fetchSiteContext('http://127.0.0.1/', { fetchImpl: spy, lookup: publicLookup }), '');

  assert.equal(await fetchSiteContext('https://exemple.fr/', { fetchImpl: async () => okResponse('{"a":1}', { type: 'application/json' }), lookup: publicLookup }), '');
  assert.equal(await fetchSiteContext('https://exemple.fr/', { fetchImpl: async () => okResponse('', { status: 500 }), lookup: publicLookup }), '');
  assert.equal(await fetchSiteContext('https://exemple.fr/', { fetchImpl: async () => { throw new Error('reseau'); }, lookup: publicLookup }), '');
});

test('lecture du site : une redirection vers une adresse interne ou trop longue est refusee, une redirection saine est suivie', async () => {
  const redirect = (location) => okResponse('', { status: 302, headers: { location } });

  // Redirection saine
  const calls = [];
  const sane = await fetchSiteContext('https://exemple.fr/', {
    lookup: publicLookup,
    fetchImpl: async (url) => { calls.push(url); return calls.length === 1 ? redirect('https://www.exemple.fr/accueil') : okResponse(HTML); },
  });
  assert.match(sane, /Titre :/);
  assert.equal(calls[1], 'https://www.exemple.fr/accueil');

  // Redirection vers une IP litterale, un autre protocole, un nom interne
  for (const target of ['http://169.254.169.254/latest/meta-data', 'ftp://exemple.fr/x', 'http://localhost:3000/', 'http://intranet/']) {
    assert.equal(await fetchSiteContext('https://exemple.fr/', { lookup: publicLookup, fetchImpl: async () => redirect(target) }), '', target);
  }

  // Redirection dont le nom pointe vers une adresse privee (DNS)
  const dnsLookup = async (host) => (host === 'piege.exemple.fr' ? [{ address: '192.168.0.5' }] : [{ address: '93.184.216.34' }]);
  let second = 0;
  assert.equal(await fetchSiteContext('https://exemple.fr/', {
    lookup: dnsLookup,
    fetchImpl: async () => { second += 1; return second === 1 ? redirect('https://piege.exemple.fr/') : okResponse(HTML); },
  }), '');
  assert.equal(second, 1, 'la seconde requete n est jamais envoyee');

  // Boucle de redirections
  assert.equal(await fetchSiteContext('https://exemple.fr/', { lookup: publicLookup, fetchImpl: async () => redirect('https://exemple.fr/') }), '');
});

test('lecture du site : cache en memoire, y compris pour un echec (pas de nouvelle requete a chaque slide)', async () => {
  clearSiteContextCache();
  let hits = 0;
  const options = { lookup: publicLookup, fetchImpl: async () => { hits += 1; return okResponse(HTML); } };
  const first = await getSiteContext('https://cache.exemple.fr/', options);
  const second = await getSiteContext('https://cache.exemple.fr/', options);
  assert.equal(first, second);
  assert.equal(hits, 1);

  let failures = 0;
  const failing = { lookup: publicLookup, fetchImpl: async () => { failures += 1; throw new Error('reseau'); } };
  assert.equal(await getSiteContext('https://panne.exemple.fr/', failing), '');
  assert.equal(await getSiteContext('https://panne.exemple.fr/', failing), '');
  assert.equal(failures, 1);
  assert.equal(await getSiteContext('', failing), '');
  clearSiteContextCache();
});

test('hashtags : sans #, minuscules, sans ponctuation ni doublon, 8 au plus', () => {
  assert.deepEqual(normalizeHashtags(['#Skincare', 'skincare', '  Peau Nette ', '#bien-être', '#a', 'x'.repeat(50), '', null, '#Énergie!']), ['skincare', 'peaunette', 'bienêtre', 'énergie']);
  assert.equal(normalizeHashtags(Array.from({ length: 20 }, (_, i) => `tag${i}`)).length, 8);
  assert.deepEqual(normalizeHashtags('pas une liste'), []);
});

test('legende de marque : JSON lu, hashtags retires du texte, formate avec une ligne vide avant les hashtags', () => {
  const parsed = parseBrandCaption('```json\n{"caption": "Votre peau mérite mieux #skincare\\nDiagnostic en 60 secondes.", "hashtags": ["#Skincare", "diagnosticpeau", "#institut"]}\n```');
  assert.equal(parsed.caption, 'Votre peau mérite mieux\nDiagnostic en 60 secondes.');
  assert.deepEqual(parsed.hashtags, ['skincare', 'diagnosticpeau', 'institut']);
  assert.equal(formatBrandCaption(parsed), 'Votre peau mérite mieux\nDiagnostic en 60 secondes.\n\n#skincare #diagnosticpeau #institut');
  assert.equal(formatBrandCaption({ caption: 'Seul', hashtags: [] }), 'Seul');

  for (const bad of ['', 'du texte libre', '{"caption": ""}', '{"hashtags": ["a"]}', '[1,2]', null]) {
    assert.equal(parseBrandCaption(bad), null, String(bad));
  }
});

test('legende de marque : le prompt exige le francais, la voix de la marque, rien d invente, des hashtags propres au contenu', () => {
  const context = { name: 'Skinalyze', niche: 'Beauté, skincare', description: 'Diagnostic peau en 60 secondes', audience: 'Instituts', website: 'https://skinalyze.sassify.fr/', siteText: 'Titre : Skinalyze', voice: '' };
  const prompt = buildBrandCaptionSystemPrompt(context, { hashtags: true });
  assert.match(prompt, /marque Skinalyze/);
  assert.match(prompt, /Écris en français/);
  assert.match(prompt, /voix de la MARQUE/);
  assert.match(prompt, /Jamais la voix d'une personne fictive/);
  assert.match(prompt, /UNIQUEMENT sur ce que disent la fiche et le site/);
  assert.match(prompt, /sans #lifestyle ni #dailyvibes/);
  assert.match(prompt, /Titre : Skinalyze/);
  assert.match(prompt, /"hashtags": \[string/);

  // Par defaut (AUTO_HASHTAGS absent) : aucun hashtag, les mots recherches vont dans le texte.
  const noTags = buildBrandCaptionSystemPrompt(context);
  assert.match(noTags, /Aucun hashtag/);
  assert.match(noTags, /\{"caption": string\}/);
  assert.ok(!noTags.includes('"hashtags"'));
  assert.match(noTags, /voix de la MARQUE/);
  assert.match(buildBrandCaptionUserPrompt({ contentType: 'feed', sceneDescription: 'Location: flat lay' }), /post \(feed\)[\s\S]*flat lay/);
  assert.match(buildBrandCaptionUserPrompt({ contentType: 'story' }), /story[\s\S]*non précisé/);
});

test('contexte de marque : seuls les profils BRAND en ont un, borne en taille, avec ou sans site', async () => {
  const rows = {
    brand: { id: 'b1', userId: 'u1', name: 'Skinalyze', profileType: 'BRAND', niche: 'Beauté', description: 'Diagnostic peau', website: '', targetAudience: 'Instituts' },
    persona: { id: 'p1', userId: 'u1', name: 'Mélina', profileType: 'PERSONA', niche: 'x', description: '', website: '', targetAudience: '' },
  };
  const prisma = {
    profile: {
      findFirst: async ({ where, select }) => {
        const row = Object.values(rows).find((item) => item.id === where.id && (!where.userId || where.userId === item.userId));
        if (!row) return null;
        return select?.personality ? { personality: null } : row;
      },
    },
  };

  const context = await loadBrandContext(prisma, 'b1', 'u1');
  assert.equal(context.name, 'Skinalyze');
  assert.equal(context.siteText, '', 'sans site : pas de texte de site');
  assert.equal(await loadBrandContext(prisma, 'p1', 'u1'), null, 'une persona n a pas de contexte de marque');
  assert.equal(await loadBrandContext(prisma, 'b1', 'autre-compte'), null, 'le profil doit appartenir au compte');
  assert.equal(await loadBrandContext(prisma, 'inconnu', 'u1'), null);
  assert.equal(await loadBrandContext(prisma, '', 'u1'), null);
  assert.equal(await loadBrandContext(null, 'b1'), null);
  // Sans compte (worker de generation, contenu deja verifie) : retrouve par identifiant.
  assert.equal((await loadBrandContext(prisma, 'b1')).name, 'Skinalyze');

  const quiet = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await loadBrandContext({ profile: { findFirst: async () => { throw new Error('colonne absente'); } } }, 'b1', 'u1'), null);
  } finally {
    console.warn = quiet;
  }

  const block = buildBrandContextBlock({ ...context, siteText: 'Titre : Skinalyze '.repeat(300), website: 'https://skinalyze.sassify.fr/' });
  assert.match(block, /^Contexte de la marque/);
  assert.match(block, /Nom : Skinalyze/);
  assert.match(block, /Ce que dit son site/);
  assert.ok(block.length < 3200);
  assert.equal(buildBrandContextBlock(null), '');
  assert.equal(buildBrandContextBlock({}), '');
});

test('assistants : le contexte de marque s ajoute seulement quand il est fourni ; sinon prompts identiques a avant', () => {
  const block = 'Contexte de la marque (fiche et site de la marque) :\n- Nom : Skinalyze';

  const carouselBase = buildCarouselAssistSystemPrompt();
  assert.equal(buildCarouselAssistSystemPrompt({ brandContext: '' }), carouselBase);
  const carousel = buildCarouselAssistSystemPrompt({ brandContext: block });
  assert.ok(carousel.includes(block));
  assert.ok(carousel.includes(BRAND_ASSIST_RULE));
  assert.ok(!carouselBase.includes('Contexte de la marque'));

  const imageBase = buildPromptAssistSystemPrompt({ mediaType: 'image' });
  assert.equal(buildPromptAssistSystemPrompt({ mediaType: 'image', brandContext: '' }), imageBase);
  const image = buildPromptAssistSystemPrompt({ mediaType: 'image', brandContext: block });
  assert.ok(image.includes(block) && image.includes(BRAND_ASSIST_RULE));

  // Les videos ne recoivent pas le contexte de marque.
  const videoBase = buildPromptAssistSystemPrompt({ mediaType: 'video' });
  assert.equal(buildPromptAssistSystemPrompt({ mediaType: 'video', brandContext: block }), videoBase);
});
