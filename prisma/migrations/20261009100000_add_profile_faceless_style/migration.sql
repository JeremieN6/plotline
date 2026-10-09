-- Video faceless : direction artistique (DA) d une persona -- palette, police,
-- style de cartes, fond, mouvement, sous-titres, regles de montage, voix, et
-- pack d avatars (adresses des images generees). Un seul champ JSON, NULL tant
-- que rien n est enregistre (la DA par defaut s applique alors). Colonne
-- nullable : aucune donnee existante n est modifiee.
-- Table "Influencer" = modele Prisma `Profile`.
ALTER TABLE "Influencer" ADD COLUMN IF NOT EXISTS "facelessStyle" JSONB;
