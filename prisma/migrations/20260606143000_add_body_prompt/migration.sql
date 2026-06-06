-- AlterTable: add optional bodyPrompt for per-influencer body guidance
ALTER TABLE "Influencer" ADD COLUMN "bodyPrompt" TEXT;
