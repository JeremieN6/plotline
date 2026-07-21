-- Plotline manual migration for Neon SQL Editor
-- Adds Influencer.silhouette and removes Hair Lock columns.
-- Safe to run multiple times where possible.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'SilhouetteType'
  ) THEN
    CREATE TYPE "SilhouetteType" AS ENUM ('SLIM', 'ATHLETIC', 'CURVY', 'VOLUPTUOUS');
  END IF;
END
$$;

ALTER TABLE "Influencer"
  ADD COLUMN IF NOT EXISTS "silhouette" "SilhouetteType" NOT NULL DEFAULT 'VOLUPTUOUS';

UPDATE "Influencer"
SET "silhouette" = 'VOLUPTUOUS'
WHERE "silhouette" IS NULL;

ALTER TABLE "Influencer"
  DROP COLUMN IF EXISTS "hairAutoPrompt";

ALTER TABLE "Influencer"
  DROP COLUMN IF EXISTS "hairLocked";
