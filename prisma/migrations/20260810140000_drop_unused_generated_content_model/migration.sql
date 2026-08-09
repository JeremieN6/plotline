-- La colonne "GeneratedContent"."generationModel" n est plus ni ecrite ni lue:
-- le modele de generation vit desormais sur "ContentVersion", au niveau du rendu
-- qui l a reellement produit. On la supprime, mais pas avant d avoir recupere ce
-- qu elle contenait encore.

-- 1) La migration d amorcage de l historique (20260808100000) avait copie
-- imageUrl/caption/prompt mais PAS le modele: les contenus anterieurs afficheraient
-- donc une pastille vide apres suppression de la colonne. On repare cela ici.
UPDATE "ContentVersion" cv
SET "generationModel" = gc."generationModel"
FROM "GeneratedContent" gc
WHERE cv."contentId" = gc."id"
  AND cv."generationModel" IS NULL
  AND gc."generationModel" IS NOT NULL;

-- 2) La colonne devient inutile.
ALTER TABLE "GeneratedContent"
  DROP COLUMN IF EXISTS "generationModel";
