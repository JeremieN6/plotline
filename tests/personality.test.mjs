import test from 'node:test';
import assert from 'node:assert/strict';

import { PERSONALITY_BLOCKS, PERSONALITY_KINDS } from '../server/data/personalityBlocks.js';
import { PERSONALITY_SEEDS } from '../server/data/personalitySeeds.js';
import {
  buildProvidedFromProfile,
  collectProtectedFields,
  createSeededRng,
  drawFromList,
  drawSeeds,
  getAdminGuardStatus,
  mergePersonality,
  normalizeEccentricity,
  normalizePersonality,
  normalizeProvided,
  buildProfileConstraints,
  stripColumnFields,
  truncateClean,
} from '../server/utils/personality.js';
import {
  isPersonalityError,
  buildPersonalitySystemPrompt,
  drawAgeRange,
  generatePersonality,
  parsePersonalityResult,
  selectTargetFields,
} from '../server/utils/personalityGenerator.js';
import { isAdminEmail } from '../server/utils/adminAccounts.js';

function fakeClient(...texts) {
  const calls = [];
  const queue = [...texts];
  return {
    calls,
    messages: {
      async create(params) {
        calls.push(params);
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return { content: [{ type: 'text', text: next }] };
      },
    },
  };
}

function fullResponse(kind, overrides = {}) {
  const out = {};
  for (const block of PERSONALITY_BLOCKS[kind]) {
    out[block.key] = {};
    for (const field of block.fields) {
      out[block.key][field.key] = field.type === 'list' ? [`${field.key} un`, `${field.key} deux`] : field.type === 'number' ? 41 : `valeur ${field.key}`;
    }
  }
  for (const [path, value] of Object.entries(overrides)) {
    const [blockKey, fieldKey] = path.split('.');
    out[blockKey][fieldKey] = value;
  }
  return JSON.stringify(out);
}

// --- Registre et graines ----------------------------------------------------

test('le registre déclare PERSONA, BRAND et ACTIVITY, chaque champ a une consigne', () => {
  assert.deepEqual(PERSONALITY_KINDS, ['PERSONA', 'BRAND', 'ACTIVITY']);
  for (const kind of PERSONALITY_KINDS) {
    for (const block of PERSONALITY_BLOCKS[kind]) {
      for (const field of block.fields) {
        assert.ok(field.assistHint, `${kind}.${block.key}.${field.key} sans consigne`);
        assert.ok(['text', 'longtext', 'number', 'list'].includes(field.type));
        if (field.seedable) assert.ok(PERSONALITY_SEEDS[field.seedCategory], `graine inconnue ${field.seedCategory}`);
      }
    }
  }
});

test('chaque catégorie de graines contient au moins 30 entrées sans doublon', () => {
  for (const [category, list] of Object.entries(PERSONALITY_SEEDS)) {
    assert.ok(list.length >= 30, `${category} : ${list.length}`);
    assert.equal(new Set(list.map((item) => String(item.value))).size, list.length, `${category} : doublons`);
    assert.ok(list.every((item) => [1, 2, 3].includes(item.level)));
  }
});

test('l âge est optionnel, jamais tiré d office, et plafonné à 18 ans minimum', () => {
  const age = PERSONALITY_BLOCKS.PERSONA[0].fields.find((field) => field.key === 'age');
  assert.equal(age.optional, true);
  assert.equal(age.seedable, undefined);
  assert.equal(age.min, 18);
  assert.equal(normalizePersonality({ blocks: { identity: { age: { value: 12, origin: 'user' } } } }, 'PERSONA').blocks.identity.age.value, 18);
  assert.ok(PERSONALITY_SEEDS.ages.every((item) => item.value >= 18));
});

// --- drawSeeds --------------------------------------------------------------

test('drawSeeds : déterministe avec un RNG injecté', () => {
  const a = drawSeeds('PERSONA', 3, createSeededRng(42));
  const b = drawSeeds('PERSONA', 3, createSeededRng(42));
  const c = drawSeeds('PERSONA', 3, createSeededRng(43));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.occupation && a.contradiction && a.obsessions && a.location && a.tone && a.rituals);
  assert.ok(a.lifeConstraints, 'graine de contexte');
  assert.equal(a.age, undefined, 'pas de graine d âge');
});

test('drawSeeds : l excentricité 1 ne pioche que du niveau 1, la 5 jamais du niveau 1', () => {
  const levelOf = (category, value) => PERSONALITY_SEEDS[category].find((item) => item.value === value).level;
  for (let i = 0; i < 40; i += 1) {
    const low = drawSeeds('PERSONA', 1, createSeededRng(i));
    assert.equal(levelOf('occupations', low.occupation), 1);
    const high = drawSeeds('PERSONA', 5, createSeededRng(i));
    assert.notEqual(levelOf('occupations', high.occupation), 1);
  }
});

test('drawSeeds : aucune graine pour un champ protégé, et pour les blocs non demandés', () => {
  const seeds = drawSeeds('PERSONA', 3, createSeededRng(1), { protectedFields: new Set(['identity.occupation']) });
  assert.equal(seeds.occupation, undefined);
  assert.ok(seeds.contradiction);

  const onlyVoice = drawSeeds('PERSONA', 3, createSeededRng(1), { only: ['voice'] });
  assert.deepEqual(Object.keys(onlyVoice), ['tone']);
});

test('drawFromList : liste vide ou absente = null ; excentricité hors bornes ramenée entre 1 et 5', () => {
  assert.equal(drawFromList([], 3), null);
  assert.equal(drawFromList(undefined, 3), null);
  assert.equal(normalizeEccentricity(99), 5);
  assert.equal(normalizeEccentricity(-4), 1);
  assert.equal(normalizeEccentricity('abc'), 3);
});

// --- normalizePersonality ---------------------------------------------------

test('normalizePersonality : vide, malformé ou de mauvais type donne toujours une structure valide', () => {
  for (const raw of [null, undefined, '', 'pas du json', '[]', 42, { blocks: 'x' }, { blocks: { identity: 'x' } }]) {
    const result = normalizePersonality(raw, 'PERSONA');
    assert.equal(result.version, 1);
    assert.equal(result.kind, 'PERSONA');
    assert.deepEqual(result.blocks, {});
    assert.equal(result.eccentricity, 3);
  }
});

test('normalizePersonality : clés inconnues ignorées, valeurs tronquées, types forcés', () => {
  const result = normalizePersonality({
    kind: 'PERSONA',
    mystere: 1,
    blocks: {
      inconnu: { x: { value: 'a' } },
      platforms: {
        bioX: { value: 'x'.repeat(400), origin: 'user' },
        handles: { value: 'a\nb\nb\nc\nd', origin: 'generated' },
        champInconnu: { value: 'z' },
      },
      identity: { age: { value: '37.6' }, firstName: 12 },
    },
  }, 'PERSONA');

  assert.equal(result.mystere, undefined);
  assert.equal(result.blocks.inconnu, undefined);
  assert.equal(result.blocks.platforms.champInconnu, undefined);
  assert.ok(result.blocks.platforms.bioX.value.length <= 160);
  assert.equal(result.blocks.platforms.bioX.origin, 'user');
  assert.deepEqual(result.blocks.platforms.handles.value, ['a', 'b', 'c']);
  assert.equal(result.blocks.identity.age.value, 38);
  assert.equal(result.blocks.identity.firstName.value, '12');
  assert.equal(result.blocks.identity.firstName.origin, 'generated');
});

test('normalizePersonality : accepte le texte JSON et reprend le type de profil', () => {
  const result = normalizePersonality(JSON.stringify({ kind: 'BRAND', blocks: { mission: { mission: { value: 'Faire X', origin: 'user' } } } }));
  assert.equal(result.kind, 'BRAND');
  assert.equal(result.blocks.mission.mission.value, 'Faire X');
});

test('limites des bios par plateforme', () => {
  const fields = PERSONALITY_BLOCKS.PERSONA.find((block) => block.key === 'platforms').fields;
  const max = (key) => fields.find((field) => field.key === key).max;
  assert.equal(max('bioInstagram'), 150);
  assert.equal(max('bioTiktok'), 80);
  assert.equal(max('bioX'), 160);

  const long = 'Réparatrice de radios anciennes, diagnostics du lundi et pièces détachées introuvables, avec un humour sec et une patience infinie pour les soudures ratées';
  const result = normalizePersonality({ blocks: { platforms: { bioTiktok: { value: long } } } }, 'PERSONA');
  const bio = result.blocks.platforms.bioTiktok.value;
  assert.ok(bio.length <= 80);
  assert.ok(!bio.endsWith(' '));
  assert.ok(long.startsWith(bio), 'tronquée proprement, sans mot coupé inventé');
  assert.equal(truncateClean('court', 80), 'court');
});

// --- mergePersonality -------------------------------------------------------

test('mergePersonality : un champ « user » ou verrouillé n est jamais écrasé, un champ généré l est', () => {
  const existing = {
    kind: 'PERSONA',
    blocks: {
      identity: {
        firstName: { value: 'Maude', origin: 'user' },
        lastName: { value: 'Ancien', origin: 'generated' },
        nickname: { value: 'Mo', origin: 'generated', locked: true },
      },
    },
  };
  const generated = {
    blocks: {
      identity: { firstName: { value: 'Autre' }, lastName: { value: 'Nouveau' }, nickname: { value: 'Zozo' } },
      voice: { tone: { value: 'sec' } },
    },
  };

  const merged = mergePersonality(existing, generated, null, 'PERSONA');
  assert.equal(merged.blocks.identity.firstName.value, 'Maude');
  assert.equal(merged.blocks.identity.firstName.origin, 'user');
  assert.equal(merged.blocks.identity.lastName.value, 'Nouveau');
  assert.equal(merged.blocks.identity.lastName.origin, 'generated');
  assert.equal(merged.blocks.identity.nickname.value, 'Mo');
  assert.equal(merged.blocks.voice.tone.value, 'sec', 'bloc absent complété');
  assert.deepEqual([...collectProtectedFields(merged)].sort(), ['identity.firstName', 'identity.nickname']);
});

test('mergePersonality : la saisie courante (provided) l emporte et passe en « user »', () => {
  const existing = { blocks: { identity: { firstName: { value: 'Maude', origin: 'generated' } } } };
  const merged = mergePersonality(existing, null, { identity: { firstName: 'Zoé' } }, 'PERSONA');
  assert.equal(merged.blocks.identity.firstName.value, 'Zoé');
  assert.equal(merged.blocks.identity.firstName.origin, 'user');
});

test('mergePersonality : conserve les champs absents de la génération et fusionne les graines', () => {
  const existing = { seeds: { occupation: 'a' }, eccentricity: 4, blocks: { backstory: { foundingEvent: { value: 'X', origin: 'generated' } } } };
  const merged = mergePersonality(existing, { seeds: { tone: 'b' }, blocks: {} }, null, 'PERSONA');
  assert.equal(merged.blocks.backstory.foundingEvent.value, 'X');
  assert.deepEqual(merged.seeds, { occupation: 'a', tone: 'b' });
  assert.equal(merged.eccentricity, 4);
});

// --- Colonnes du profil -----------------------------------------------------

test('buildProvidedFromProfile : les champs reliés à une colonne viennent de la colonne', () => {
  const provided = buildProvidedFromProfile({ name: 'Maude', niche: 'radios anciennes, brocante, soudure', style: 'lumière de garage' }, 'PERSONA');
  assert.equal(provided.identity.displayName.value, 'Maude');
  assert.equal(provided.editorial.mainNiche.value, 'radios anciennes');
  assert.deepEqual(provided.editorial.secondaryNiches.value, ['brocante', 'soudure']);
  assert.equal(provided.appearance.visualStyle.value, 'lumière de garage');
  assert.equal(provided.appearance.distinctiveSigns, undefined, 'colonne vide : pas de contrainte');
  assert.ok(Object.values(provided).every((fields) => Object.values(fields).every((entry) => entry.origin === 'user')));
});

test('normalizeProvided : valeurs nues transformées en champs « user », vides ignorées', () => {
  const provided = normalizeProvided({ identity: { firstName: ' Zoé ', lastName: '', age: '' }, inconnu: { a: 1 } }, 'PERSONA');
  assert.deepEqual(provided, { identity: { firstName: { value: 'Zoé', origin: 'user' } } });
});

// --- Garde admin ------------------------------------------------------------

test('garde admin : 401 sans session, 403 pour un non-admin, autorisé pour un admin', () => {
  assert.equal(getAdminGuardStatus(null), 401);
  assert.equal(getAdminGuardStatus({ id: 'u1', email: 'a@b.fr', isAdmin: false }), 403);
  assert.equal(getAdminGuardStatus({ id: 'u1', email: 'a@b.fr', isAdmin: true }), null);
  assert.equal(isAdminEmail('Boss@Exemple.fr', 'boss@exemple.fr, autre@exemple.fr'), true);
  assert.equal(isAdminEmail('inconnu@exemple.fr', 'boss@exemple.fr'), false);
});

// --- Générateur (client Claude simulé : aucun appel réel) --------------------

test('generatePersonality : champs saisis respectés, jamais redemandés, bios limitées aux plateformes choisies', async () => {
  const client = fakeClient(fullResponse('PERSONA', { 'identity.firstName': 'IGNORE' }));
  const { personality, generated } = await generatePersonality({
    kind: 'PERSONA',
    provided: { identity: { firstName: 'Maude' } },
    platforms: ['instagram'],
    eccentricity: 4,
  }, { client, rng: createSeededRng(7) });

  assert.equal(client.calls.length, 1);
  const prompt = client.calls[0].system;
  assert.match(prompt, /identity\.firstName \(Prenom\) : Maude/);
  assert.doesNotMatch(prompt, /"firstName" —/);
  assert.match(prompt, /"bioInstagram"/);
  assert.doesNotMatch(prompt, /"bioTiktok"/);
  assert.match(prompt, /Excentricité 4\/5/);
  assert.match(prompt, /wellness/, 'liste anti-clichés');
  assert.match(prompt, /langue : fr/);

  assert.equal(personality.blocks.identity.firstName.value, 'Maude');
  assert.equal(personality.blocks.identity.firstName.origin, 'user');
  assert.equal(personality.blocks.platforms.bioInstagram.origin, 'generated');
  assert.equal(personality.blocks.platforms.bioTiktok, undefined);
  assert.ok(generated > 20);
  assert.ok(personality.seeds.occupation);
});

test('generatePersonality : sans aucune entrée, tout est tiré au sort', async () => {
  const client = fakeClient(fullResponse('PERSONA'));
  const { personality } = await generatePersonality({}, { client, rng: createSeededRng(3) });
  assert.equal(personality.kind, 'PERSONA');
  assert.ok(Object.keys(personality.blocks).length >= 8);
});

test('generatePersonality : regénération d un bloc, champs verrouillés figés, autres blocs inchangés', async () => {
  const existing = {
    kind: 'PERSONA',
    seeds: { occupation: 'x' },
    blocks: {
      identity: { firstName: { value: 'Maude', origin: 'generated' } },
      voice: { tone: { value: 'ancien ton', origin: 'generated', locked: true }, humor: { value: 'ancien humour', origin: 'generated' } },
    },
  };
  const voice = { ...JSON.parse(fullResponse('PERSONA')).voice, humor: 'nouvel humour', tone: 'ignoré' };
  const client = fakeClient(JSON.stringify({ voice }));
  const { personality } = await generatePersonality({ kind: 'PERSONA', existing, onlyBlocks: ['voice'] }, { client, rng: createSeededRng(5) });

  assert.equal(personality.blocks.voice.tone.value, 'ancien ton');
  assert.equal(personality.blocks.voice.humor.value, 'nouvel humour');
  assert.equal(personality.blocks.identity.firstName.value, 'Maude');
  assert.match(client.calls[0].system, /identity\.firstName \(Prenom\) : Maude/, 'cohérence avec les autres blocs');
  assert.doesNotMatch(client.calls[0].system, /Bloc "identity"/);
});

test('generatePersonality : une seule nouvelle tentative si le JSON est invalide, puis erreur claire', async () => {
  const retry = fakeClient('pas du json', fullResponse('PERSONA'));
  const ok = await generatePersonality({}, { client: retry, rng: createSeededRng(1) });
  assert.equal(retry.calls.length, 2);
  assert.ok(ok.generated > 0);

  const failing = fakeClient('pas du json', '{"identity":{}}');
  await assert.rejects(
    () => generatePersonality({}, { client: failing, rng: createSeededRng(1) }),
    (error) => isPersonalityError(error) && error.code === 'invalid' && error.status === 502,
  );
  assert.equal(failing.calls.length, 2);
});

test('generatePersonality : API indisponible = 503, clé absente = 503, bloc inconnu = 400', async () => {
  const down = fakeClient(Object.assign(new Error('Service Unavailable'), { status: 503 }));
  await assert.rejects(
    () => generatePersonality({}, { client: down, rng: createSeededRng(1) }),
    (error) => error.code === 'unavailable' && error.status === 503,
  );

  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  await assert.rejects(
    () => generatePersonality({}, { rng: createSeededRng(1) }),
    (error) => error.code === 'config' && error.status === 503,
  );
  if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;

  await assert.rejects(
    () => generatePersonality({ onlyBlocks: ['nope'] }, { client: fakeClient('{}') }),
    (error) => error.code === 'bad_request' && error.status === 400,
  );
});

test('generatePersonality : tout est déjà renseigné = aucun appel à Claude', async () => {
  const provided = {};
  for (const block of PERSONALITY_BLOCKS.BRAND) {
    provided[block.key] = {};
    for (const field of block.fields) {
      provided[block.key][field.key] = field.type === 'list' ? ['a'] : field.type === 'number' ? 30 : 'v';
    }
  }
  const client = fakeClient();
  const { personality, generated } = await generatePersonality({ kind: 'BRAND', provided }, { client });
  assert.equal(client.calls.length, 0);
  assert.equal(generated, 0);
  assert.equal(personality.blocks.mission.mission.origin, 'user');
});

test('prompt et sélection : contraintes, langue, type de profil', () => {
  const targets = selectTargetFields('BRAND', { onlyBlocks: ['mission'], platforms: undefined, protectedFields: new Set(['mission.mission']) });
  assert.ok(targets.every(({ block }) => block.key === 'mission'));
  assert.ok(!targets.some(({ field }) => field.key === 'mission'));

  const prompt = buildPersonalitySystemPrompt({
    kind: 'BRAND', targets, fixed: ['mission.mission (Mission) : Faire X'], context: [], seeds: {}, eccentricity: 2, language: 'en', freeText: 'atelier de reliure',
  });
  assert.match(prompt, /type marque/);
  assert.match(prompt, /langue : en/);
  assert.match(prompt, /NON NÉGOCIABLES/);
  assert.match(prompt, /atelier de reliure/);
});

test('anti-clichés : consignes sans exemples-gabarits, formules interdites, tranche d âge', () => {
  const hints = PERSONALITY_BLOCKS.PERSONA.flatMap((block) => block.fields).map((field) => field.assistHint).join('\n');
  assert.doesNotMatch(hints, /Ex : "Parle comme/);
  assert.doesNotMatch(hints, /en a 140/);
  assert.doesNotMatch(hints, /origine en quelques mots entre parentheses/);

  const targets = selectTargetFields('PERSONA', { onlyBlocks: ['identity'], platforms: undefined, protectedFields: new Set() });
  const base = { kind: 'PERSONA', targets, fixed: [], context: [], seeds: {}, eccentricity: 3, language: 'fr', freeText: '' };
  const prompt = buildPersonalitySystemPrompt({ ...base, ageRange: '26 à 35 ans' });
  assert.match(prompt, /Parle comme quelqu un qui/);
  assert.match(prompt, /Métier\. Lieu\. Chiffre\. Emoji/);
  assert.match(prompt, /tranche indicative \(26 à 35 ans\)/);
  assert.doesNotMatch(buildPersonalitySystemPrompt(base), /tranche indicative/);

  // Toutes les tranches restent adultes et la tirage est répartissable.
  const drawn = new Set(Array.from({ length: 40 }, (_, i) => drawAgeRange(createSeededRng(i))));
  assert.ok(drawn.size >= 3);
  assert.ok(![...drawn].some((range) => /^1[0-7] /.test(range)));
});

test('stripColumnFields : retire les champs portés par une colonne, garde le reste, ne modifie pas l entrée', () => {
  const input = {
    kind: 'PERSONA',
    eccentricity: 4,
    seeds: {},
    blocks: {
      identity: {
        displayName: { value: 'Maude R.', origin: 'user' },
        age: { value: 34, origin: 'generated', locked: true },
      },
      voice: { tone: { value: 'Sec et patient, pince-sans-rire', origin: 'generated' } },
    },
  };
  const before = JSON.stringify(input);
  const stripped = stripColumnFields(input, 'PERSONA');
  assert.equal(JSON.stringify(input), before);
  assert.equal(stripped.blocks.identity.displayName, undefined);
  assert.equal(stripped.blocks.identity.age.value, 34);
  assert.equal(stripped.blocks.identity.age.locked, true);
  assert.equal(stripped.blocks.voice.tone.origin, 'generated');
  assert.equal(stripped.eccentricity, 4);

  const onlyColumn = stripColumnFields({ blocks: { identity: { displayName: { value: 'X', origin: 'user' } } } }, 'PERSONA');
  assert.equal(onlyColumn.blocks.identity, undefined);
});

test('profil existant : le physique déjà figé est imposé à Claude et jamais stocké', async () => {
  const profile = {
    gender: 'MALE',
    silhouette: 'ATHLETIC',
    eyeColor: 'vert',
    ethnicity: 'peau mate, origine maghrébine',
    hairPrompt: 'cheveux courts noirs, légèrement bouclés',
    bodyPrompt: null,
    faceRefPath: '/media/face.jpg',
  };
  const constraints = buildProfileConstraints(profile);
  assert.ok(constraints.some((line) => /Genre du personnage : homme/.test(line)));
  assert.ok(constraints.some((line) => /yeux déjà définie : vert/.test(line)));
  assert.ok(constraints.some((line) => /Cheveux déjà définis/.test(line)));
  assert.ok(constraints.some((line) => /fiche de référence visage existe déjà/.test(line)));
  // Le prompt de corps (technique, explicite) et la silhouette (souvent un défaut) ne sont jamais transmis.
  const withBody = buildProfileConstraints({ ...profile, bodyPrompt: 'voluptuous hourglass figure', silhouette: 'VOLUPTUOUS' });
  assert.ok(!withBody.join(' ').match(/voluptuous|Silhouette|Corps/i));

  // Rien pour un profil absent ; un profil sans physique renseigné n invente rien.
  assert.deepEqual(buildProfileConstraints(null), []);
  assert.deepEqual(buildProfileConstraints({ ethnicity: '  ', eyeColor: null, hairPrompt: '' }), []);

  // Une valeur trop longue est tronquée.
  const long = buildProfileConstraints({ hairPrompt: 'x'.repeat(600) })[0];
  assert.ok(long.length < 300);

  // Les contraintes arrivent dans le prompt envoyé à Claude, pas dans la personnalité stockée.
  const client = fakeClient(fullResponse('PERSONA'));
  const { personality } = await generatePersonality(
    { kind: 'PERSONA', profileConstraints: constraints },
    { client, rng: createSeededRng(11) },
  );
  const system = client.calls[0].system;
  assert.match(system, /Champs imposés/);
  assert.match(system, /Genre du personnage : homme/);
  assert.match(system, /Cheveux déjà définis : cheveux courts noirs/);
  assert.ok(!JSON.stringify(personality).includes('Genre du personnage'));

  // Sans contraintes, aucune ligne de ce type dans le prompt.
  const plain = fakeClient(fullResponse('PERSONA'));
  await generatePersonality({ kind: 'PERSONA' }, { client: plain, rng: createSeededRng(11) });
  assert.doesNotMatch(plain.calls[0].system, /Genre du personnage|déjà définie/);
});

test('graines d obsessions : toutes les formes ne sont pas des collections', () => {
  const values = PERSONALITY_SEEDS.obsessions.map((item) => item.value);
  assert.ok(values.length >= 45);
  assert.equal(new Set(values).size, values.length);
  const nonCollection = values.filter((value) => !/^les |^le /.test(value));
  assert.ok(nonCollection.length >= 15);
});

test('parsePersonalityResult : clôtures markdown retirées, réponse trop partielle rejetée', () => {
  const targets = selectTargetFields('PERSONA', { onlyBlocks: ['voice'], platforms: undefined, protectedFields: new Set() });
  const body = fullResponse('PERSONA');
  const fenced = `\`\`\`json\n${body}\n\`\`\``;
  const parsed = parsePersonalityResult(fenced, 'PERSONA', targets);
  assert.ok(parsed.blocks.voice.tone);
  assert.equal(parsePersonalityResult('{"voice":{"tone":"x"}}', 'PERSONA', targets), null);
  assert.equal(parsePersonalityResult('', 'PERSONA', targets), null);
  assert.equal(parsePersonalityResult('[1,2]', 'PERSONA', targets), null);
});
