-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_batchId_fkey";

-- DropForeignKey
ALTER TABLE "Batch" DROP CONSTRAINT "Batch_personaId_fkey";

-- DropForeignKey
ALTER TABLE "Persona" DROP CONSTRAINT "Persona_userId_fkey";

-- DropTable
DROP TABLE "Post";

-- DropTable
DROP TABLE "Batch";

-- DropTable
DROP TABLE "Persona";

-- CreateEnum
CREATE TYPE "ContentPlatform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'BOTH');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('FEED', 'STORY', 'REEL');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'VALIDATED', 'PUBLISHED', 'REJECTED');

-- CreateTable
CREATE TABLE "Influencer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "faceRefPath" TEXT,
    "bodyRefPath" TEXT,
    "instagramAccountId" TEXT,
    "instagramAccessToken" TEXT,
    "tiktokEnabled" BOOLEAN NOT NULL DEFAULT false,
    "calendarStep" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Influencer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedContent" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "platform" "ContentPlatform" NOT NULL DEFAULT 'INSTAGRAM',
    "format" "ContentFormat" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Influencer" ADD CONSTRAINT "Influencer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
