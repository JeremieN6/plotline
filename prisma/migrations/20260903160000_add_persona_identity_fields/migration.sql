-- Champs d'identite deja demandes a la creation d'une persona (couleur des yeux,
-- origine ethnique, particularites) mais jamais persistes jusqu'ici: ils ne
-- servaient qu'a construire le prompt ponctuel de generation de la face ref.
-- Necessaires pour que persona.description (widgets Studio) puisse les relire.
ALTER TABLE "Influencer" ADD COLUMN "eyeColor" TEXT;
ALTER TABLE "Influencer" ADD COLUMN "ethnicity" TEXT;
ALTER TABLE "Influencer" ADD COLUMN "particularities" TEXT;
