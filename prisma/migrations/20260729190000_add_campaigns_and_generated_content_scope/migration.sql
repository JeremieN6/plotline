DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Campaign'
  ) THEN
    CREATE TABLE "Campaign" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "objective" TEXT,
      "channel" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Campaign_userId_fkey'
  ) THEN
    ALTER TABLE "Campaign"
      ADD CONSTRAINT "Campaign_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Campaign_userId_createdAt_idx"
  ON "Campaign"("userId", "createdAt");

ALTER TABLE "GeneratedContent"
  ADD COLUMN IF NOT EXISTS "brandId" TEXT,
  ADD COLUMN IF NOT EXISTS "ambassadorId" TEXT,
  ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GeneratedContent_campaignId_fkey'
  ) THEN
    ALTER TABLE "GeneratedContent"
      ADD CONSTRAINT "GeneratedContent_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
