-- AlterTable: add identityProfile column to Influencer with default "default"
ALTER TABLE "Influencer" ADD COLUMN "identityProfile" TEXT NOT NULL DEFAULT 'default';
