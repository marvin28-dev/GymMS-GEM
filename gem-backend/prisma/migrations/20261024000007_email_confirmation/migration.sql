-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifyExpires" TIMESTAMP(3),
ADD COLUMN     "emailVerifyHash" TEXT;

