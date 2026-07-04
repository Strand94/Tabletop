-- CreateTable
CREATE TABLE "bgg_catalog" (
    "bgg_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "rank" INTEGER,
    "average" DECIMAL(4,2),
    "bayes_average" DECIMAL(4,2),
    "users_rated" INTEGER,
    "thumbnail" TEXT,
    "snapshot_date" DATE,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bgg_catalog_pkey" PRIMARY KEY ("bgg_id")
);

-- CreateIndex
CREATE INDEX "bgg_catalog_name_idx" ON "bgg_catalog"("name");

-- CreateIndex
CREATE INDEX "bgg_catalog_rank_idx" ON "bgg_catalog"("rank");
