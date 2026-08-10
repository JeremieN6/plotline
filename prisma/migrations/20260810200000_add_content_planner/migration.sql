-- Planificateur editorial.
--
-- Un plan est une liste d idees datees, proposees puis relues AVANT que le
-- moindre media soit produit: valider un texte coute une requete Claude,
-- valider apres generation coute autant de videos que d idees.
--
-- La cadence vit sur le profil: dans un compte agence, chaque influenceur a son
-- propre rythme, independamment des campagnes.

-- 1) Etat d un plan.
DO $$
BEGIN
  CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'DISCARDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) Cadence du profil.
-- `calendarStep` existe deja et servait de curseur de rotation, mais n etait
-- jamais incremente: il reprend enfin son role, comme position dans la rotation.
ALTER TABLE "Influencer"
  ADD COLUMN IF NOT EXISTS "postsPerWeek" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "formatRotation" TEXT NOT NULL DEFAULT 'FEED,STORY,REEL',
  ADD COLUMN IF NOT EXISTS "publishHour" INTEGER NOT NULL DEFAULT 18;

-- 3) Le plan lui-meme.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ContentPlan'
  ) THEN
    CREATE TABLE "ContentPlan" (
      "id" TEXT NOT NULL,
      "profileId" TEXT NOT NULL,
      "campaignId" TEXT,
      "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
      "startDate" TIMESTAMP(3) NOT NULL,
      "days" INTEGER NOT NULL DEFAULT 7,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ContentPlan_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE "ContentPlan"
    ADD CONSTRAINT "ContentPlan_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ContentPlan"
    ADD CONSTRAINT "ContentPlan_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ContentPlan_profileId_createdAt_idx"
  ON "ContentPlan"("profileId", "createdAt");

-- 4) Les idees du plan.
-- `keep` permet d ecarter une idee a la revue sans la supprimer, et `contentId`
-- relie l idee au contenu genere une fois le plan approuve: on sait ainsi ce qui
-- a deja ete produit et on ne le regenere pas deux fois.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ContentPlanItem'
  ) THEN
    CREATE TABLE "ContentPlanItem" (
      "id" TEXT NOT NULL,
      "planId" TEXT NOT NULL,
      "position" INTEGER NOT NULL,
      "prompt" TEXT NOT NULL,
      "caption" TEXT,
      "hashtags" TEXT,
      "platform" "ContentPlatform" NOT NULL DEFAULT 'INSTAGRAM',
      "format" "ContentFormat" NOT NULL,
      "scheduledAt" TIMESTAMP(3) NOT NULL,
      "keep" BOOLEAN NOT NULL DEFAULT true,
      "contentId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ContentPlanItem_pkey" PRIMARY KEY ("id")
    );
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE "ContentPlanItem"
    ADD CONSTRAINT "ContentPlanItem_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "ContentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Le contenu genere peut etre supprime sans emporter l historique du plan.
DO $$
BEGIN
  ALTER TABLE "ContentPlanItem"
    ADD CONSTRAINT "ContentPlanItem_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "GeneratedContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ContentPlanItem_planId_position_idx"
  ON "ContentPlanItem"("planId", "position");
