import test from 'node:test';
import assert from 'node:assert/strict';

import { ORPHAN_MAX_AGE_MS, orphanCutoff, sweepOrphanedGenerations } from '../server/utils/orphanedGenerations.js';
import { activeFacelessJobCount, inBackground, waitForActiveFacelessJobs } from '../server/utils/facelessVideoJob.js';

const fakePrisma = () => {
  const calls = [];
  return {
    calls,
    generatedContent: {
      updateMany: async (args) => { calls.push(args); return { count: 2 }; },
    },
  };
};

test('le balayage ne touche que les PROCESSING anciens et sans media', async () => {
  const prisma = fakePrisma();
  const now = new Date('2026-10-27T10:00:00Z');
  const count = await sweepOrphanedGenerations(prisma, { now });

  assert.equal(count, 2);
  const { where, data } = prisma.calls[0];
  assert.equal(where.status, 'PROCESSING');
  assert.deepEqual(where.createdAt.lt, orphanCutoff(now));
  assert.equal(where.createdAt.lt.getTime(), now.getTime() - ORPHAN_MAX_AGE_MS);
  assert.deepEqual(where.OR, [{ imageUrl: null }, { imageUrl: '' }]);
  assert.equal(data.status, 'FAILED');
  assert.ok(data.errorMessage);
});

test('un job faceless en cours est suivi puis oublie, et l arret l attend', async () => {
  const prisma = { generatedContent: { findUnique: async () => null, updateMany: async () => ({}) } };
  let release;
  const gate = new Promise((resolve) => { release = resolve; });

  inBackground(prisma, 'c1', 'PENDING', () => gate);
  assert.equal(activeFacelessJobCount(), 1);

  // Le delai court : le job tient encore, l attente rend la main avec 1 job actif.
  assert.equal(await waitForActiveFacelessJobs(20), 1);

  release();
  assert.equal(await waitForActiveFacelessJobs(1000), 0);
  assert.equal(activeFacelessJobCount(), 0);
});

test('un job qui echoue est aussi retire de la liste', async () => {
  const prisma = { generatedContent: { findUnique: async () => null, updateMany: async () => ({}) } };
  inBackground(prisma, 'c2', 'PENDING', async () => { throw new Error('boom'); });
  assert.equal(await waitForActiveFacelessJobs(1000), 0);
});
