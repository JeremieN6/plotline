import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPasswordAccount,
  findOrCreateGoogleUser,
  signupsEnabled,
} from '../server/utils/accountAccess.js';

/** Base factice : des comptes en memoire et le journal de tout ce qui ecrit. */
function fakePrisma(users = []) {
  const writes = [];
  const wipe = (table) => ({
    deleteMany: async ({ where }) => {
      writes.push([`${table}.deleteMany`, where]);
      return { count: 1 };
    },
  });

  return {
    writes,
    user: {
      findUnique: async ({ where }) => {
        const [key, value] = Object.entries(where)[0];
        return users.find((u) => u[key] === value) || null;
      },
      create: async ({ data }) => {
        writes.push(['user.create', data]);
        return { id: 'nouveau', email: data.email };
      },
      update: async ({ where, data }) => {
        writes.push(['user.update', data]);
        return { id: where.id, email: users.find((u) => u.id === where.id).email };
      },
    },
    authSession: wipe('authSession'),
    passwordResetToken: wipe('passwordResetToken'),
    emailChangeToken: wipe('emailChangeToken'),
    $transaction: async (operations) => Promise.all(operations),
  };
}

const profile = { googleId: 'google-1', email: 'proprio@exemple.test' };

test('les inscriptions sont fermees tant que SIGNUPS_ENABLED ne dit pas oui', () => {
  for (const raw of ['', 'false', '0', 'non', ' ']) assert.equal(signupsEnabled(raw), false);
  for (const raw of ['true', ' TRUE ', '1', 'yes']) assert.equal(signupsEnabled(raw), true);
});

test('l inscription ne touche jamais un compte existant, avec ou sans mot de passe', async () => {
  for (const passwordHash of [null, 'sel:empreinte']) {
    const prisma = fakePrisma([{ id: 'u1', email: profile.email, passwordHash }]);
    await assert.rejects(
      createPasswordAccount(prisma, { email: profile.email, passwordHash: 'intrus:empreinte' }),
      { statusCode: 409 },
    );
    assert.deepEqual(prisma.writes, []);
  }
});

test('l inscription cree le compte d une adresse inconnue et refuse un doublon simultane', async () => {
  const prisma = fakePrisma();
  const user = await createPasswordAccount(prisma, { email: 'a@exemple.test', passwordHash: 'x:y' });
  assert.equal(user.id, 'nouveau');

  prisma.user.create = async () => {
    throw Object.assign(new Error('unique'), { code: 'P2002' });
  };
  await assert.rejects(createPasswordAccount(prisma, { email: 'b@exemple.test', passwordHash: 'x:y' }), { statusCode: 409 });
});

test('Google connecte un compte deja rattache sans rien modifier, meme inscriptions fermees', async () => {
  const prisma = fakePrisma([{ id: 'u1', email: profile.email, googleId: profile.googleId }]);
  const result = await findOrCreateGoogleUser(prisma, profile, { signupsAllowed: false });
  assert.equal(result.outcome, 'signin');
  assert.deepEqual(prisma.writes, []);
});

test('le premier rattachement Google retire le mot de passe non prouve, les sessions et les liens en attente', async () => {
  const prisma = fakePrisma([{ id: 'u1', email: profile.email, passwordHash: 'intrus:empreinte', googleId: null }]);
  const result = await findOrCreateGoogleUser(prisma, profile, { signupsAllowed: false });

  assert.equal(result.outcome, 'linked');
  assert.deepEqual(prisma.writes, [
    ['user.update', { googleId: profile.googleId, passwordHash: null }],
    ['authSession.deleteMany', { userId: 'u1' }],
    ['passwordResetToken.deleteMany', { userId: 'u1' }],
    ['emailChangeToken.deleteMany', { userId: 'u1' }],
  ]);
});

test('Google refuse un compte rattache a un autre identifiant', async () => {
  const prisma = fakePrisma([{ id: 'u1', email: profile.email, googleId: 'autre' }]);
  await assert.rejects(findOrCreateGoogleUser(prisma, profile, { signupsAllowed: true }), /deja associe/);
  assert.deepEqual(prisma.writes, []);
});

test('Google ne cree un compte que si les inscriptions sont ouvertes', async () => {
  const closed = fakePrisma();
  await assert.rejects(findOrCreateGoogleUser(closed, profile, { signupsAllowed: false }), { statusCode: 403 });
  assert.deepEqual(closed.writes, []);

  const open = fakePrisma();
  const result = await findOrCreateGoogleUser(open, profile, { signupsAllowed: true });
  assert.equal(result.outcome, 'signup');
});
