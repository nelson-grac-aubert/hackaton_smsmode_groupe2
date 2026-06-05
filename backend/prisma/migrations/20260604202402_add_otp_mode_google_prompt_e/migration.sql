/*
  Warnings:

  - You are about to drop the column `brandColor` on the `OtpApp` table. All the data in the column will be lost.
  - You are about to drop the column `fallbackAfter` on the `OtpApp` table. All the data in the column will be lost.
  - You are about to drop the column `locale` on the `OtpApp` table. All the data in the column will be lost.
  - You are about to drop the column `smsFallback` on the `OtpApp` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OtpMode" AS ENUM ('CLASSIC', 'GOOGLE_PROMPT');

-- AlterTable
ALTER TABLE "OtpApp" DROP COLUMN "brandColor",
DROP COLUMN "fallbackAfter",
DROP COLUMN "locale",
DROP COLUMN "smsFallback",
ADD COLUMN     "otpMode" "OtpMode" NOT NULL DEFAULT 'CLASSIC',
ALTER COLUMN "messageTemplate" SET DEFAULT 'Votre code {{brand}} est valable {{ttl}} min.';

-- AlterTable
ALTER TABLE "OtpTransaction" ADD COLUMN     "promptDigit" INTEGER;
