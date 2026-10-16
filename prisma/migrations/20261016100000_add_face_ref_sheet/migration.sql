-- Galerie des fiches de reference visage generees.
-- Chaque fiche generee par /api/generate/face-ref est conservee (fichier sur le
-- Blob + une ligne ici) pour pouvoir la retrouver, la telecharger ou l appliquer
-- plus tard a une persona, au lieu de ne vivre que dans l onglet du navigateur.
--
-- "profileId" : persona pour laquelle la fiche a ete generee, NULL si elle l a
-- ete avant la creation de la persona. Supprimer la persona ne supprime pas la
-- fiche (SET NULL). "method" : TEXT valide cote code ('default', 'contact_sheet_9'...).
--
-- A appliquer a la main dans l editeur SQL de Neon (jamais depuis le projet).

CREATE TABLE IF NOT EXISTS "FaceRefSheet" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "profileId" TEXT,
  "imageUrl"  TEXT NOT NULL,
  "method"    TEXT NOT NULL DEFAULT 'default',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaceRefSheet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FaceRefSheet_userId_createdAt_idx"
  ON "FaceRefSheet"("userId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "FaceRefSheet"
    ADD CONSTRAINT "FaceRefSheet_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "FaceRefSheet"
    ADD CONSTRAINT "FaceRefSheet_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
