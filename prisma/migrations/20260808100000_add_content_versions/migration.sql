DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ContentVersion'
  ) THEN
    CREATE TABLE "ContentVersion" (
      "id" TEXT NOT NULL,
      "contentId" TEXT NOT NULL,
      "imageUrl" TEXT,
      "caption" TEXT,
      "prompt" TEXT,
      "generationModel" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ContentVersion_contentId_fkey'
  ) THEN
    ALTER TABLE "ContentVersion"
      ADD CONSTRAINT "ContentVersion_contentId_fkey"
      FOREIGN KEY ("contentId") REFERENCES "GeneratedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ContentVersion_contentId_createdAt_idx"
  ON "ContentVersion"("contentId", "createdAt");

-- Amorce l historique avec le rendu courant des contenus qui en ont deja un,
-- afin que la vue versions ne soit pas vide sur l existant.
INSERT INTO "ContentVersion" ("id", "contentId", "imageUrl", "caption", "prompt", "isActive", "createdAt")
SELECT
  gen_random_uuid()::text,
  gc."id",
  gc."imageUrl",
  gc."caption",
  gc."prompt",
  true,
  gc."createdAt"
FROM "GeneratedContent" gc
WHERE gc."imageUrl" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ContentVersion" cv WHERE cv."contentId" = gc."id"
  );
