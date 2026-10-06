-- Bibliotheque d assets de reference au niveau du COMPTE (voiture, maison, rue,
-- bijou, chaussures, chapeau, accessoire). Un asset porte 1 a 8 photos sources,
-- chacune avec un role (exterieur, interieur, detail...), et une fiche de
-- reference generee a la demande par Gemini.
--
-- "type" et le role de chaque photo sont du TEXT valide cote code, pas des enums
-- Postgres: ajouter un type ou un role ne demande aucune migration.
--
-- A appliquer a la main dans l editeur SQL de Neon (jamais depuis le projet).

CREATE TABLE IF NOT EXISTS "ReferenceAsset" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  -- Photos sources : tableau JSON ordonne [{ "url": "...", "role": "EXTERIOR" }, ...], 1 a 8 entrees.
  "sources"       JSONB NOT NULL DEFAULT '[]',
  "sheetUrl"      TEXT,
  -- true quand les photos ont change depuis la derniere generation de la fiche.
  "sheetOutdated" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferenceAsset_pkey" PRIMARY KEY ("id")
);

-- Le code (ex. CAR_arkana) est unique par compte : il sert a etiqueter l asset dans les prompts.
CREATE UNIQUE INDEX IF NOT EXISTS "ReferenceAsset_userId_code_key"
  ON "ReferenceAsset"("userId", "code");

CREATE INDEX IF NOT EXISTS "ReferenceAsset_userId_type_idx"
  ON "ReferenceAsset"("userId", "type");

DO $$
BEGIN
  ALTER TABLE "ReferenceAsset"
    ADD CONSTRAINT "ReferenceAsset_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
