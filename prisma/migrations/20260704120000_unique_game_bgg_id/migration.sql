-- DropIndex
DROP INDEX "game_bgg_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "game_bgg_id_key" ON "game"("bgg_id");
