-- Genre du persona: la creation etait entierement pensee au feminin (silhouettes,
-- placeholders). Ajoute un axe genre + deux silhouettes masculines, sans toucher
-- au comportement des personas existantes (defaut FEMALE = comportement actuel).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Gender') THEN
    CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE');
  END IF;
END $$;

ALTER TABLE "Influencer" ADD COLUMN IF NOT EXISTS "gender" "Gender" NOT NULL DEFAULT 'FEMALE';

ALTER TYPE "SilhouetteType" ADD VALUE IF NOT EXISTS 'MUSCULAR';
ALTER TYPE "SilhouetteType" ADD VALUE IF NOT EXISTS 'STOCKY';
