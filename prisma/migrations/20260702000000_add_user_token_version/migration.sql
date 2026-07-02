-- AlterTable: add refresh-token revocation counter (spec review #3)
ALTER TABLE "user" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
