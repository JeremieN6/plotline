// Usage: node scripts/update-email.js ANCIEN_EMAIL NOUVEL_EMAIL
import('./server/utils/prisma.js').then(async ({ prisma }) => {
  const oldEmail = process.argv[2];
  const newEmail = process.argv[3];

  if (!oldEmail || !newEmail) {
    console.error('Usage: node scripts/update-email.js ANCIEN_EMAIL NOUVEL_EMAIL');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: oldEmail } });
  if (!user) {
    console.error('Aucun compte trouve avec cet email:', oldEmail);
    process.exit(1);
  }

  await prisma.user.update({
    where: { email: oldEmail },
    data: { email: newEmail },
  });

  console.log('Email mis a jour:', oldEmail, '->', newEmail);
}).catch((e) => { console.error(e); process.exit(1); });
