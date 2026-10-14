import test from 'node:test';
import assert from 'node:assert/strict';

import { readPlanCaption } from '../server/utils/planCaption.js';

function fakePrisma({ planItems = [], contents = {}, failOn } = {}) {
  return {
    contentPlanItem: {
      findFirst: async ({ where }) => {
        if (failOn === 'planItem') throw new Error('boum');
        return planItems.includes(where.contentId) ? { id: 'item1' } : null;
      },
    },
    generatedContent: {
      findUnique: async ({ where }) => {
        if (failOn === 'content') throw new Error('boum');
        return contents[where.id] ? { caption: contents[where.id] } : null;
      },
    },
  };
}

test('contenu issu d un plan avec une legende relue : la legende est conservee (hashtags compris)', async () => {
  const prisma = fakePrisma({ planItems: ['c1'], contents: { c1: '  Un mardi de feuilles\n\n#automne #usagi  ' } });
  assert.equal(await readPlanCaption(prisma, 'c1'), 'Un mardi de feuilles\n\n#automne #usagi');
});

test('contenu hors plan : rien (la legende sera generee comme avant), meme s il porte deja un texte', async () => {
  const prisma = fakePrisma({ planItems: [], contents: { c2: 'ancienne legende generee' } });
  assert.equal(await readPlanCaption(prisma, 'c2'), '');
});

test('contenu de plan sans legende : rien, la legende est generee', async () => {
  assert.equal(await readPlanCaption(fakePrisma({ planItems: ['c3'], contents: { c3: '   ' } }), 'c3'), '');
  assert.equal(await readPlanCaption(fakePrisma({ planItems: ['c4'], contents: {} }), 'c4'), '');
});

test('erreur de lecture ou arguments absents : jamais d exception, retour a l ancien comportement', async () => {
  const quiet = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await readPlanCaption(fakePrisma({ failOn: 'planItem' }), 'c1'), '');
    assert.equal(await readPlanCaption(fakePrisma({ planItems: ['c1'], failOn: 'content' }), 'c1'), '');
  } finally {
    console.warn = quiet;
  }
  assert.equal(await readPlanCaption(null, 'c1'), '');
  assert.equal(await readPlanCaption(fakePrisma(), ''), '');
  assert.equal(await readPlanCaption(fakePrisma(), undefined), '');
});
