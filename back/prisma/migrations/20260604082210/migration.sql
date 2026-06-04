/*
  Warnings:

  - A unique constraint covering the columns `[mail]` on the table `OtpApp` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mail` to the `OtpApp` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OtpApp" ADD COLUMN     "mail" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OtpApp_mail_key" ON "OtpApp"("mail");
