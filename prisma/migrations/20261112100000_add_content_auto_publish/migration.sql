-- Publication AUTOMATIQUE a la date planifiee : opt-in par contenu.
-- FALSE (defaut) = la date sert de repere au calendrier, l outil ne publie rien tout seul.
-- TRUE = le planificateur publie le contenu valide a sa date (comportement d origine).
-- Les contenus deja planifies passent donc en « repere seulement » (rien ne part tout seul).
-- A appliquer a la main dans l editeur SQL de Neon (jamais depuis le projet).
ALTER TABLE "GeneratedContent"
  ADD COLUMN IF NOT EXISTS "autoPublish" BOOLEAN NOT NULL DEFAULT FALSE;
