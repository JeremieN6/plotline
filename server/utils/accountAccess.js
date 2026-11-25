/**
 * Qui peut creer un compte, et comment un compte existant se rattache a Google.
 *
 * Deux regles :
 *  - les inscriptions sont FERMEES par defaut (SIGNUPS_ENABLED=true pour les
 *    rouvrir) : chaque compte peut declencher des generations payantes ;
 *  - l inscription ne modifie JAMAIS un compte existant : rien n y prouve que
 *    la personne possede l adresse saisie. Un mot de passe ne s ajoute que par
 *    le lien envoye a cette adresse (mot de passe oublie) ou en etant connecte.
 */

export const SIGNUPS_CLOSED_MESSAGE = 'Les inscriptions sont fermees pour le moment';
export const ACCOUNT_EXISTS_MESSAGE = 'Un compte existe deja avec cet email. Connecte-toi ou utilise Mot de passe oublie';

const PUBLIC_USER_FIELDS = {
  id: true,
  email: true,
  plan: true,
  accountType: true,
  createdAt: true,
};

export function signupsEnabled(raw = process.env.SIGNUPS_ENABLED) {
  return ['true', '1', 'yes'].includes(String(raw || '').trim().toLowerCase());
}

/** Le code d erreur suit la forme attendue par `createError`. */
function accountError(statusCode, statusMessage) {
  return Object.assign(new Error(statusMessage), { statusCode, statusMessage });
}

export async function createPasswordAccount(prisma, { email, passwordHash }) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw accountError(409, ACCOUNT_EXISTS_MESSAGE);
  }

  try {
    return await prisma.user.create({ data: { email, passwordHash }, select: PUBLIC_USER_FIELDS });
  } catch (error) {
    // Deux inscriptions simultanees : la contrainte d unicite tranche.
    if (error?.code === 'P2002') {
      throw accountError(409, ACCOUNT_EXISTS_MESSAGE);
    }
    throw error;
  }
}

/**
 * Retrouve ou cree le compte correspondant au profil Google.
 *
 * L identifiant Google (`sub`) prime sur l email. `profile` doit deja avoir
 * passe `assertUsableProfile` : le rattachement par email ne vaut que sur une
 * adresse verifiee par Google.
 *
 * Au premier rattachement, Google prouve que la personne possede l adresse ; le
 * mot de passe deja pose sur le compte, lui, n a jamais ete prouve (n importe
 * qui a pu s inscrire avec cette adresse avant elle). Il est donc retire, avec
 * les sessions et les liens en attente. Le proprietaire peut en remettre un par
 * Mot de passe oublie.
 */
export async function findOrCreateGoogleUser(prisma, profile, { signupsAllowed = signupsEnabled() } = {}) {
  const select = { id: true, email: true };

  const byGoogleId = await prisma.user.findUnique({ where: { googleId: profile.googleId }, select });
  if (byGoogleId) {
    return { user: byGoogleId, outcome: 'signin' };
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { ...select, googleId: true },
  });

  if (byEmail) {
    // Le compte porte deja un autre identifiant Google: cas anormal, on refuse
    // plutot que d ecraser un rattachement existant.
    if (byEmail.googleId) {
      throw new Error('Ce compte est deja associe a un autre compte Google');
    }

    const where = { userId: byEmail.id };
    const [linked] = await prisma.$transaction([
      prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId: profile.googleId, passwordHash: null },
        select,
      }),
      prisma.authSession.deleteMany({ where }),
      prisma.passwordResetToken.deleteMany({ where }),
      prisma.emailChangeToken.deleteMany({ where }),
    ]);

    return { user: linked, outcome: 'linked' };
  }

  if (!signupsAllowed) {
    throw accountError(403, SIGNUPS_CLOSED_MESSAGE);
  }

  const created = await prisma.user.create({
    data: { email: profile.email, googleId: profile.googleId },
    select,
  });

  return { user: created, outcome: 'signup' };
}
