-- Assets de la bibliotheque joints a une generation d image du Studio.
-- Tableau JSON d identifiants (chaines), dans l ordre de selection, pour que
-- "Modifier" / la regeneration rejouent les memes references. NULL = aucun asset.
-- A appliquer a la main dans l editeur SQL de Neon (jamais depuis le projet).
ALTER TABLE "GeneratedContent"
  ADD COLUMN IF NOT EXISTS "referenceAssetIds" JSONB;
