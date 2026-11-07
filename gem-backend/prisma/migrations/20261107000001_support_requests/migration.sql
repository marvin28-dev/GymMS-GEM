-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT,
    "senderPhone" TEXT,
    "senderRole" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "userAgent" TEXT,
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportRequest_gymId_staffId_createdAt_idx" ON "SupportRequest"("gymId", "staffId", "createdAt");
