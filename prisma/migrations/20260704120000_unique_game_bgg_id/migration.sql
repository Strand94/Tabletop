-- Clear duplicate bgg_id links (keep the earliest game per id) so the unique index can be created.
UPDATE "game" SET "bgg_id" = NULL
WHERE "bgg_id" IS NOT NULL
  AND "id" NOT IN (SELECT MIN("id") FROM "game" WHERE "bgg_id" IS NOT NULL GROUP BY "bgg_id");

-- DropIndex
DROP INDEX "game_bgg_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "game_bgg_id_key" ON "game"("bgg_id");
