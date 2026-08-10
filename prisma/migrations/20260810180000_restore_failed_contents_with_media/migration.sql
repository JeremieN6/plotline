-- Reparation ponctuelle: des contenus sont restes en FAILED alors que leur media
-- precedent est toujours en base.
--
-- Cause: une regeneration ratee basculait le contenu en FAILED sans regarder si
-- un rendu valide subsistait. Le fichier n a jamais ete supprime, mais le contenu
-- sortait des listes et paraissait perdu. Le code ne le fait plus.
--
-- On ne touche qu aux lignes qui ont encore un media: celles reellement vides
-- restent en FAILED, ce qui est le bon statut pour elles.
UPDATE "GeneratedContent"
SET
  "status" = 'PENDING'::"ContentStatus",
  -- L erreur reste consultable ailleurs; on nettoie le champ pour que le contenu
  -- ne s affiche pas en anomalie alors qu il est de nouveau exploitable.
  "errorMessage" = NULL
WHERE "status" = 'FAILED'::"ContentStatus"
  AND COALESCE(TRIM("imageUrl"), '') <> '';
