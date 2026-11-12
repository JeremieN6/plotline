-- Reseaux choisis au moment de PLANIFIER un contenu (aucune verification de connexion pour l instant).
-- JSON : liste de plateformes, ex. ["INSTAGRAM", "X"]. NULL = aucun choix enregistre (contenus planifies avant ce reglage).
-- Seul INSTAGRAM est publie automatiquement par le planificateur ; les autres reseaux sont un repere de calendrier.
-- A appliquer a la main dans l editeur SQL de Neon (jamais depuis le projet).
ALTER TABLE "GeneratedContent"
  ADD COLUMN IF NOT EXISTS "plannedPlatforms" JSONB;
