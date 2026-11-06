-- Publication faite A LA MAIN (hors de l outil) : date reelle et plateformes.
-- JSON { at: "2026-11-05T17:30:00.000Z", platforms: ["TIKTOK", "INSTAGRAM"] }.
-- NULL = jamais marque comme publie a la main.
-- A appliquer a la main dans l editeur SQL de Neon (jamais depuis le projet).
ALTER TABLE "GeneratedContent"
  ADD COLUMN IF NOT EXISTS "manualPublication" JSONB;
