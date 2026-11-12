-- Reglage du profil : publication automatique a la date planifiee, activee ou non PAR DEFAUT pour ses contenus.
-- FALSE (defaut) = les contenus planifies ne sont que des reperes de calendrier.
-- Sert de valeur de depart a l interrupteur des fenetres de planification ; chaque contenu garde son propre reglage.
-- Table "Influencer" : le modele Prisma `Profile` y est mappe.
-- A appliquer a la main dans l editeur SQL de Neon (jamais depuis le projet).
ALTER TABLE "Influencer"
  ADD COLUMN IF NOT EXISTS "autoPublish" BOOLEAN NOT NULL DEFAULT FALSE;
