/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'BLOCKED', 'REPORTED');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('RCS', 'SMS');

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- DropTable
DROP TABLE "Post";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "OtpApp" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "ttlSeconds" INTEGER NOT NULL DEFAULT 300,
    "codeLength" INTEGER NOT NULL DEFAULT 6,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "resendCooldown" INTEGER NOT NULL DEFAULT 30,
    "smsFallback" BOOLEAN NOT NULL DEFAULT true,
    "fallbackAfter" INTEGER NOT NULL DEFAULT 20,
    "oneTapEnabled" BOOLEAN NOT NULL DEFAULT true,
    "verifyRedirectUrl" TEXT NOT NULL,
    "senderLabel" TEXT NOT NULL DEFAULT 'Verification',
    "brandColor" TEXT NOT NULL DEFAULT '#0F6E56',
    "logoUrl" TEXT,
    "cardTitle" TEXT NOT NULL DEFAULT 'Code de vérification',
    "messageTemplate" TEXT NOT NULL DEFAULT 'Votre code est {{code}}, valable {{ttl}} min.',
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "allowedCountries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rateLimitPhone" INTEGER NOT NULL DEFAULT 5,
    "rateLimitIp" INTEGER NOT NULL DEFAULT 20,
    "reportEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpTransaction" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "tapToken" TEXT,
    "tapUsed" BOOLEAN NOT NULL DEFAULT false,
    "status" "OtpStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "channel" "Channel" NOT NULL DEFAULT 'RCS',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OtpApp_apiKey_key" ON "OtpApp"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "OtpTransaction_tapToken_key" ON "OtpTransaction"("tapToken");

-- AddForeignKey
ALTER TABLE "OtpTransaction" ADD CONSTRAINT "OtpTransaction_appId_fkey" FOREIGN KEY ("appId") REFERENCES "OtpApp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
