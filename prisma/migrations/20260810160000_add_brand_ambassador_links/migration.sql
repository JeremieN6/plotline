-- Une ambassadrice peut representer plusieurs marques. Le lien passe donc d une
-- colonne "Influencer"."brandId" (une seule marque) a une table de liaison.
--
-- "brandId" est conserve tel quel: le code sait encore le lire en repli tant que
-- cette migration n est pas passee partout. Il sera supprime dans un second temps.

-- 1) Table de liaison marque <-> ambassadrice.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'BrandAmbassador'
  ) THEN
    CREATE TABLE "BrandAmbassador" (
      "id" TEXT NOT NULL,
      "brandId" TEXT NOT NULL,
      "ambassadorId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BrandAmbassador_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE "BrandAmbassador"
    ADD CONSTRAINT "BrandAmbassador_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "BrandAmbassador"
    ADD CONSTRAINT "BrandAmbassador_ambassadorId_fkey"
    FOREIGN KEY ("ambassadorId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Un meme couple ne peut pas exister deux fois: c est ce qui rend le
-- rattachement idempotent cote application.
CREATE UNIQUE INDEX IF NOT EXISTS "BrandAmbassador_brandId_ambassadorId_key"
  ON "BrandAmbassador"("brandId", "ambassadorId");

CREATE INDEX IF NOT EXISTS "BrandAmbassador_ambassadorId_idx"
  ON "BrandAmbassador"("ambassadorId");

-- 2) Reprise des rattachements existants portes par "brandId".
INSERT INTO "BrandAmbassador" ("id", "brandId", "ambassadorId", "createdAt")
SELECT
  gen_random_uuid()::text,
  amb."brandId",
  amb."id",
  NOW()
FROM "Influencer" amb
WHERE amb."brandId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "BrandAmbassador" existing
    WHERE existing."brandId" = amb."brandId"
      AND existing."ambassadorId" = amb."id"
  );

-- 3) Ecriture du type reel des profils.
-- Il etait NULL sur tous les profils existants, et l API le devinait a la volee
-- (face ref presente -> PERSONA, sinon BRAND). On fige exactement ce qui etait
-- deja affiche: aucun profil ne change d apparence, mais le produit cesse de
-- deviner et le rattachement devient possible.
UPDATE "Influencer"
SET "profileType" = 'PERSONA'::"ProfileType"
WHERE "profileType" IS NULL
  AND COALESCE(TRIM("faceRefPath"), '') <> '';

UPDATE "Influencer"
SET "profileType" = 'BRAND'::"ProfileType"
WHERE "profileType" IS NULL;
