-- Personnalite d un profil (identite, histoire, voix, ligne editoriale, bios...),
-- stockee en JSON : { version, kind, eccentricity, seeds, blocks, updatedAt }.
-- La structure est pilotee par le registre cote code (server/data/personalityBlocks.js) :
-- ajouter un bloc ou un champ ne demande AUCUNE migration.
--
-- Nullable : tous les profils existants gardent personality = NULL et continuent
-- de fonctionner sans changement. Le modele Prisma `Profile` est mappe sur la
-- table "Influencer" (@@map).
--
-- A appliquer a la main dans l editeur SQL de Neon (jamais depuis le projet),
-- AVANT d ajouter `personality Json?` a schema.prisma.

ALTER TABLE "Influencer" ADD COLUMN IF NOT EXISTS "personality" JSONB;
