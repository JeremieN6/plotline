-- Video faceless : chaque version garde ce qu il faut pour etre retouchee
-- (plan de montage, adresse de la voix, temps des mots). NULL pour tous les
-- autres contenus. Colonne nullable, aucune donnee existante modifiee.
ALTER TABLE "ContentVersion" ADD COLUMN IF NOT EXISTS "renderSpec" JSONB;
