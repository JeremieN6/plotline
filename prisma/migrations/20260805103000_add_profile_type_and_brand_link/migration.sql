DO $$
BEGIN
  CREATE TYPE "ProfileType" AS ENUM ('PERSONA', 'BRAND', 'ACTIVITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Influencer"
  ADD COLUMN IF NOT EXISTS "profileType" "ProfileType",
  ADD COLUMN IF NOT EXISTS "brandId" TEXT;

DO $$
BEGIN
  ALTER TABLE "Influencer"
    ADD CONSTRAINT "Influencer_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Influencer_brandId_idx" ON "Influencer"("brandId");