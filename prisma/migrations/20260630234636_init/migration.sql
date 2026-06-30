-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('BOARD_GAME', 'CARD_GAME', 'DICE_GAME', 'MINIATURES', 'RPG', 'OTHER');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('OWNED', 'WISHLIST');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "game" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "image_path" TEXT,
    "release_year" INTEGER,
    "min_players" INTEGER,
    "max_players" INTEGER,
    "min_playtime" INTEGER,
    "max_playtime" INTEGER,
    "min_age" INTEGER,
    "weight" DECIMAL(3,2),
    "description" TEXT,
    "type" "GameType",
    "price" DECIMAL(10,2),
    "currency" TEXT NOT NULL,
    "collection_status" "CollectionStatus" NOT NULL DEFAULT 'OWNED',
    "date_added" DATE,
    "bgg_id" INTEGER,
    "bgg_rating" DECIMAL(4,2),
    "bgg_rank" INTEGER,
    "bgg_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expansion" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "image_path" TEXT,
    "release_year" INTEGER,
    "min_players" INTEGER,
    "max_players" INTEGER,
    "min_playtime" INTEGER,
    "max_playtime" INTEGER,
    "min_age" INTEGER,
    "weight" DECIMAL(3,2),
    "description" TEXT,
    "price" DECIMAL(10,2),
    "date_added" DATE,
    "bgg_id" INTEGER,
    "bgg_rating" DECIMAL(4,2),
    "bgg_rank" INTEGER,
    "bgg_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expansion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image_path" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" SERIAL NOT NULL,
    "game_id" INTEGER NOT NULL,
    "location_id" INTEGER,
    "start" TIMESTAMPTZ(6) NOT NULL,
    "end" TIMESTAMPTZ(6),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expansion_session" (
    "expansion_id" INTEGER NOT NULL,
    "session_id" INTEGER NOT NULL,

    CONSTRAINT "expansion_session_pkey" PRIMARY KEY ("expansion_id","session_id")
);

-- CreateTable
CREATE TABLE "player_session" (
    "person_id" INTEGER NOT NULL,
    "session_id" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "first_play" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,

    CONSTRAINT "player_session_pkey" PRIMARY KEY ("person_id","session_id")
);

-- CreateTable
CREATE TABLE "user_game_rating" (
    "user_id" INTEGER NOT NULL,
    "game_id" INTEGER NOT NULL,
    "rating" DECIMAL(3,1) NOT NULL,
    "review" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_game_rating_pkey" PRIMARY KEY ("user_id","game_id")
);

-- CreateTable
CREATE TABLE "user_session_rating" (
    "user_id" INTEGER NOT NULL,
    "session_id" INTEGER NOT NULL,
    "rating" DECIMAL(3,1) NOT NULL,
    "note" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_session_rating_pkey" PRIMARY KEY ("user_id","session_id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_category" (
    "game_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "game_category_pkey" PRIMARY KEY ("game_id","category_id")
);

-- CreateTable
CREATE TABLE "location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_image" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "image_path" TEXT NOT NULL,

    CONSTRAINT "session_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_collection_status_idx" ON "game"("collection_status");

-- CreateIndex
CREATE INDEX "game_bgg_id_idx" ON "game"("bgg_id");

-- CreateIndex
CREATE INDEX "expansion_game_id_idx" ON "expansion"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "person_user_id_key" ON "person"("user_id");

-- CreateIndex
CREATE INDEX "session_game_id_idx" ON "session"("game_id");

-- CreateIndex
CREATE INDEX "session_location_id_idx" ON "session"("location_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_name_key" ON "category"("name");

-- CreateIndex
CREATE INDEX "session_image_session_id_idx" ON "session_image"("session_id");

-- AddForeignKey
ALTER TABLE "expansion" ADD CONSTRAINT "expansion_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expansion_session" ADD CONSTRAINT "expansion_session_expansion_id_fkey" FOREIGN KEY ("expansion_id") REFERENCES "expansion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expansion_session" ADD CONSTRAINT "expansion_session_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_session" ADD CONSTRAINT "player_session_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_session" ADD CONSTRAINT "player_session_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_game_rating" ADD CONSTRAINT "user_game_rating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_game_rating" ADD CONSTRAINT "user_game_rating_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_session_rating" ADD CONSTRAINT "user_session_rating_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_session_rating" ADD CONSTRAINT "user_session_rating_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_category" ADD CONSTRAINT "game_category_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_category" ADD CONSTRAINT "game_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_image" ADD CONSTRAINT "session_image_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

