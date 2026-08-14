-- Connexion et inscription via Google.
--
-- L identifiant conserve est `sub`, l identifiant Google immuable, et non
-- l email: un utilisateur peut changer l adresse de son compte Google sans
-- devoir redevenir un inconnu pour Plotline.
--
-- La colonne reste nullable: les comptes crees avec mot de passe n en ont pas,
-- et un compte peut porter les deux (rattachement).
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "googleId" TEXT;

-- Unique: un compte Google ne peut etre rattache qu a un seul utilisateur.
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key"
  ON "User"("googleId");
