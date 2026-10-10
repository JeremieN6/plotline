import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPersonalityBrief } from '../server/utils/personalityBrief.js';
import { buildFacelessPlanSystemPrompt, describeFacelessPersona } from '../server/utils/facelessPlanGenerator.js';
import { buildFacelessStyleSystemPrompt } from '../server/utils/facelessStyleGenerator.js';
import { loadPersonaStyle, updateProfileStyle } from '../server/utils/facelessStyleStore.js';
import { defaultFacelessStyle } from '../server/utils/facelessStyle.js';

const entry = (value, origin = 'generated') => ({ value, origin });

function samplePersonality(extra = {}) {
  return {
    version: 1,
    kind: 'PERSONA',
    eccentricity: 3,
    seeds: {},
    blocks: {
      identity: { firstName: entry('Maude'), occupation: entry('Restauratrice de radios anciennes') },
      backstory: { foundingEvent: entry('Un atelier repris à 30 ans, secret de famille.') },
      beliefs: { coreBeliefs: entry(['Réparer vaut mieux que jeter']) },
      voice: {
        tone: entry('Sec, patient, pince-sans-rire'),
        sentenceLength: entry('Phrases courtes, souvent sans verbe'),
        humor: entry('Understatement, jamais de moquerie'),
        address: entry('Tutoiement'),
        audienceName: entry('les bricoleurs du dimanche'),
        verbalTics: entry(['bon.', 'franchement ?']),
        bannedWords: entry(['incroyable', 'game changer']),
      },
      editorial: {
        contentPillars: entry(['Réparation', 'Histoire des postes']),
        promise: entry('Comprendre ce qu on répare'),
        redLines: entry(['Jamais de politique']),
      },
      ...extra,
    },
    updatedAt: '2026-10-10T10:00:00.000Z',
  };
}

// --- buildPersonalityBrief -------------------------------------------------------

test('le pont reprend la voix et la ligne éditoriale, pas la biographie ni les croyances', () => {
  const brief = buildPersonalityBrief(samplePersonality());
  assert.match(brief, /^Personnalité détaillée/);
  assert.match(brief, /Ton : Sec, patient, pince-sans-rire/);
  assert.match(brief, /Adresse au public : Tutoiement/);
  assert.match(brief, /Mots à NE JAMAIS employer : incroyable, game changer/);
  assert.match(brief, /Tics de langage .*: bon\., franchement \?/);
  assert.match(brief, /Piliers de contenu : Réparation, Histoire des postes/);
  assert.match(brief, /À éviter absolument : Jamais de politique/);
  assert.doesNotMatch(brief, /atelier repris|secret de famille|Réparer vaut mieux|Maude/);
});

test('personnalité absente, vide ou invalide : aucun bloc, aucune erreur', () => {
  assert.equal(buildPersonalityBrief(null), '');
  assert.equal(buildPersonalityBrief(undefined), '');
  assert.equal(buildPersonalityBrief({}), '');
  assert.equal(buildPersonalityBrief('pas du json'), '');
  assert.equal(buildPersonalityBrief([1, 2]), '');
  assert.equal(buildPersonalityBrief({ blocks: { identity: { firstName: entry('Maude') } } }), '');
});

test('le contenu est normalisé : types faux et champs inconnus sont ignorés', () => {
  const brief = buildPersonalityBrief({
    blocks: {
      voice: {
        tone: entry({ injecte: 'objet au lieu d un texte' }),
        humor: entry(['liste', 'au lieu d un texte']),
        verbalTics: entry({ a: 1 }),
        bannedWords: entry(['  ok  ', '', {}, null, true]),
        inconnu: entry('ne doit pas apparaître'),
      },
      blocInconnu: { tone: entry('ne doit pas apparaître non plus') },
    },
  });
  assert.doesNotMatch(brief, /injecte|objet|liste|inconnu|apparaître/);
  assert.match(brief, /Mots à NE JAMAIS employer : ok$/m);
  assert.equal(brief.split('\n').length, 2, 'seule la ligne valide reste');
});

test('texte JSON accepté (colonne lue en chaîne)', () => {
  const brief = buildPersonalityBrief(JSON.stringify(samplePersonality()));
  assert.match(brief, /Ton : Sec, patient/);
});

test('borne de longueur : les lignes les moins importantes sautent, jamais une ligne coupée', () => {
  const full = buildPersonalityBrief(samplePersonality(), { maxChars: 5000 });
  const short = buildPersonalityBrief(samplePersonality(), { maxChars: 330 });
  assert.ok(short.length <= 330, `longueur ${short.length}`);
  assert.ok(short.length < full.length);
  // Les plus importantes survivent (voix, interdits, lignes rouges), les autres sont parties.
  assert.match(short, /Ton :/);
  assert.match(short, /Mots à NE JAMAIS employer/);
  assert.match(short, /À éviter absolument/);
  assert.doesNotMatch(short, /Piliers de contenu/);
  assert.doesNotMatch(short, /Promesse faite/);
  // Chaque ligne conservée est identique à sa version complète.
  for (const line of short.split('\n').slice(1)) assert.ok(full.includes(line), line);

  // Trop petit pour quoi que ce soit : rien plutôt qu un en-tête seul.
  assert.equal(buildPersonalityBrief(samplePersonality(), { maxChars: 20 }), '');
});

test('une valeur très longue est tronquée proprement sur une seule ligne', () => {
  const brief = buildPersonalityBrief({ blocks: { voice: { tone: entry(`${'mot '.repeat(200)}\nsuite`) } } });
  const toneLine = brief.split('\n').find((line) => line.startsWith('Ton :'));
  assert.ok(toneLine.length <= 'Ton : '.length + 220, `longueur ${toneLine.length}`);
  assert.ok(toneLine.length > 100, 'la valeur est gardee, juste raccourcie');
  assert.equal(brief.split('\n').length, 2, 'le saut de ligne de la valeur est aplati');
});

// --- describeFacelessPersona / prompts --------------------------------------------

const persona = { id: 'p1', name: 'Maude', gender: 'FEMALE', niche: 'radios anciennes', style: 'sobre', targetAudience: 'bricoleurs', description: 'Restauratrice.' };

test('describeFacelessPersona : identique à avant sans personnalité', () => {
  const expected = [
    'Nom : Maude', 'Genre : femme', 'Niche : radios anciennes', 'Style / ton : sobre', 'Public : bricoleurs', 'Presentation : Restauratrice.',
  ].join('\n');
  assert.equal(describeFacelessPersona(persona), expected);
  assert.equal(describeFacelessPersona({ ...persona, personality: null }), expected);
  assert.equal(describeFacelessPersona({ ...persona, personality: {} }), expected);
  assert.equal(describeFacelessPersona(null), '');
});

test('describeFacelessPersona : la personnalité est ajoutée, sauf demande contraire', () => {
  const withP = { ...persona, personality: samplePersonality() };
  const text = describeFacelessPersona(withP);
  assert.ok(text.startsWith('Nom : Maude'));
  assert.match(text, /Ton : Sec, patient/);
  assert.equal(describeFacelessPersona(withP, { withPersonality: false }), describeFacelessPersona(persona));
});

test('le prompt du plan faceless contient la voix de la personnalité, pas celui de la DA', () => {
  const withP = { ...persona, personality: samplePersonality() };
  const plan = buildFacelessPlanSystemPrompt({ targetSeconds: 30, persona: withP });
  assert.match(plan, /PERSONA QUI PARLE/);
  assert.match(plan, /Mots à NE JAMAIS employer : incroyable, game changer/);

  const without = buildFacelessPlanSystemPrompt({ targetSeconds: 30, persona });
  assert.doesNotMatch(without, /Personnalité détaillée/);

  // La DA est purement visuelle : la voix n y entre pas.
  const style = buildFacelessStyleSystemPrompt({ persona: withP });
  assert.doesNotMatch(style, /Personnalité détaillée|NE JAMAIS employer/);
  assert.match(style, /Nom : Maude/);
});

// --- loadPersonaStyle --------------------------------------------------------------

function fakePrisma(handler) {
  const calls = [];
  return {
    calls,
    profile: {
      async findFirst({ select }) {
        calls.push(Object.keys(select));
        return handler(select, calls.length);
      },
    },
  };
}

const baseRow = { id: 'p1', name: 'Maude', niche: 'radios', style: 'sobre', gender: 'FEMALE', description: null, targetAudience: null, faceRefPath: null };

const brutalisme = () => defaultFacelessStyle('brutalisme', 'FEMALE');

/** Prisma simule : la lecture de la DA et celle de la personnalité sont des requêtes distinctes. */
function splitPrisma({ style = null, personality = null, personalityError = null } = {}) {
  const calls = [];
  const writes = [];
  return {
    calls,
    writes,
    profile: {
      async findFirst({ select }) {
        calls.push(Object.keys(select));
        if ('personality' in select) {
          if (personalityError) throw personalityError;
          return { personality };
        }
        return { ...baseRow, ...('facelessStyle' in select ? { facelessStyle: style } : {}) };
      },
      async update({ data }) {
        writes.push(data);
        return {};
      },
    },
  };
}

test('loadPersonaStyle : la personnalité est lue à part, la lecture de la DA est celle d avant', async () => {
  const stored = samplePersonality();
  const prisma = splitPrisma({ style: brutalisme(), personality: stored });
  const loaded = await loadPersonaStyle(prisma, 'p1', 'u1');
  assert.deepEqual(loaded.persona.personality, stored);
  assert.equal(loaded.stored, true);
  // 1re requête : exactement celle d avant (DA, sans personnalité) ; 2e : la personnalité seule.
  assert.ok(prisma.calls[0].includes('facelessStyle') && !prisma.calls[0].includes('personality'));
  assert.deepEqual(prisma.calls[1], ['personality']);
});

test('lecture de la personnalité en échec : la DA est intacte, l échec est journalisé', async () => {
  // Le message de Prisma LISTE les champs disponibles, donc contient aussi "facelessStyle".
  const message = 'Unknown field `personality` for select statement on model `Profile`. Available options: id, name, facelessStyle, createdAt';
  const prisma = splitPrisma({ style: brutalisme(), personalityError: new Error(message) });
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  let loaded;
  try {
    loaded = await loadPersonaStyle(prisma, 'p1', 'u1');
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(loaded.persona.personality, undefined);
  assert.equal(loaded.stored, true, 'la DA enregistrée est bien lue');
  assert.equal(loaded.style.preset, 'brutalisme', 'ni la DA par defaut, ni une DA perdue');
  assert.equal(warnings.length, 1, 'jamais silencieux');
  assert.match(String(warnings[0][0]), /personnalite indisponible/);
});

test('REGRESSION perte de DA : réécrire la DA ne passe jamais par la lecture de la personnalité', async () => {
  const storedStyle = { ...defaultFacelessStyle('cahier-ecolier', 'FEMALE'), rules: ['Règle conservée'] };
  const message = 'Unknown field `personality` for select statement on model `Profile`. Available options: facelessStyle';
  const prisma = splitPrisma({ style: storedStyle, personalityError: new Error(message) });
  const next = await updateProfileStyle(prisma, 'p1', 'u1', (style) => ({ ...style, extra: true }));

  assert.equal(prisma.calls.length, 1, 'une seule lecture : la DA');
  assert.ok(!prisma.calls.some((keys) => keys.includes('personality')));
  assert.equal(prisma.writes.length, 1);
  assert.equal(prisma.writes[0].facelessStyle.extra, true);
  assert.equal(prisma.writes[0].facelessStyle.preset, 'cahier-ecolier', 'la DA enregistrée n est pas remplacée par la DA par défaut');
  assert.ok(JSON.stringify(prisma.writes[0].facelessStyle.rules).includes('Règle conservée'));
  assert.equal(next.preset, 'cahier-ecolier');
});

test('persona inconnue : null, sans lire la personnalité ; erreur de la DA : elle remonte comme avant', async () => {
  const none = fakePrisma(() => null);
  assert.equal(await loadPersonaStyle(none, 'p1', 'u1'), null);
  assert.equal(none.calls.length, 1);

  const broken = fakePrisma(() => { throw new Error('connexion refusée'); });
  await assert.rejects(() => loadPersonaStyle(broken, 'p1', 'u1'), /connexion refusée/);
  assert.equal(broken.calls.length, 1);
});

test('withPersonality: false : aucune lecture de la personnalité', async () => {
  const prisma = splitPrisma({ style: null, personality: samplePersonality() });
  const loaded = await loadPersonaStyle(prisma, 'p1', 'u1', { withPersonality: false });
  assert.equal(loaded.persona.personality, undefined);
  assert.equal(prisma.calls.length, 1);
});

test('persona sans personnalité enregistrée : aucune clé ajoutée à la persona', async () => {
  const prisma = splitPrisma({ style: null, personality: null });
  const loaded = await loadPersonaStyle(prisma, 'p1', 'u1');
  assert.equal('personality' in loaded.persona, false);
});
