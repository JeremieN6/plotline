-- Regroupement des slides d un carrousel.
-- Chaque slide reste un GeneratedContent autonome (avec son propre historique
-- de versions); carouselId les relie et carouselPosition fixe leur ordre.
ALTER TABLE "GeneratedContent"
  ADD COLUMN IF NOT EXISTS "carouselId" TEXT,
  ADD COLUMN IF NOT EXISTS "carouselPosition" INTEGER;

CREATE INDEX IF NOT EXISTS "GeneratedContent_carouselId_carouselPosition_idx"
  ON "GeneratedContent"("carouselId", "carouselPosition");
