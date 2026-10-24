-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'other';

-- AlterEnum
ALTER TYPE "MemberStatus" ADD VALUE 'cancelled';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskStatus" ADD VALUE 'accepted';
ALTER TYPE "TaskStatus" ADD VALUE 'declined';

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_memberId_fkey";

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "altPhone" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "payDay" INTEGER,
ADD COLUMN     "postal" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "schedule" JSONB,
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "setupCompletedAt" TIMESTAMP(3),
ADD COLUMN     "setupConfirmed" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "employmentType" TEXT DEFAULT 'Full Time',
ADD COLUMN     "houseNumber" TEXT,
ADD COLUMN     "mustSetPassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payDay" INTEGER,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3),
ADD COLUMN     "scheduleOverrides" JSONB,
ADD COLUMN     "staffNotes" JSONB,
ADD COLUMN     "street" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "coachId" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "dayPasses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "freezeFeeLastChargedAt" TIMESTAMP(3),
ADD COLUMN     "goalBodyFat" DOUBLE PRECISION,
ADD COLUMN     "goalNote" TEXT,
ADD COLUMN     "goalSessionsPerWeek" INTEGER,
ADD COLUMN     "goalSetAt" TIMESTAMP(3),
ADD COLUMN     "goalTargetDate" TIMESTAMP(3),
ADD COLUMN     "goalType" TEXT,
ADD COLUMN     "goalWaist" DOUBLE PRECISION,
ADD COLUMN     "goalWeight" DOUBLE PRECISION,
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "dayPassPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "code" TEXT,
ADD COLUMN     "costPrice" DOUBLE PRECISION,
ADD COLUMN     "discountPercent" INTEGER,
ADD COLUMN     "reorderLevel" INTEGER;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "unitCost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "balanceAtCheckIn" DOUBLE PRECISION,
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "statusAtCheckIn" TEXT,
ADD COLUMN     "workoutStaffId" TEXT,
ALTER COLUMN "memberId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "assignedGroup" TEXT,
ADD COLUMN     "assignedRole" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "createdBySystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dueSoonNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "overdueNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "timeCardId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'approved',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "approvedByName" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedById" TEXT,
ADD COLUMN     "editedByName" TEXT,
ADD COLUMN     "source" TEXT DEFAULT 'operations';

-- AlterTable
ALTER TABLE "TimeCard" ADD COLUMN     "adjustmentNote" TEXT,
ADD COLUMN     "approvalStatus" TEXT DEFAULT 'approved',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "issues" JSONB,
ADD COLUMN     "originalPunchIn" TIMESTAMP(3),
ADD COLUMN     "originalPunchOut" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "category" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memberId" TEXT;

-- AlterTable
ALTER TABLE "Communication" ADD COLUMN     "audience" JSONB,
ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'email',
ADD COLUMN     "emailFailed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailSent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "skipped" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "smsFailed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "smsSent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'sent',
ADD COLUMN     "testMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "total" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "aboutStaffId" TEXT,
ADD COLUMN     "audience" TEXT,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "staffId" TEXT;

-- CreateTable
CREATE TABLE "PayRecord" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION,
    "basePay" DOUBLE PRECISION,
    "breakdown" JSONB,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayAdjustment" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "month" TEXT,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressLog" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "staffId" TEXT,
    "kind" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "bodyFat" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "hips" DOUBLE PRECISION,
    "chest" DOUBLE PRECISION,
    "durationMin" INTEGER,
    "focus" TEXT,
    "effort" TEXT,
    "category" TEXT,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationDelivery" (
    "id" TEXT NOT NULL,
    "communicationId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "memberId" TEXT,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "address" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDismissal" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "memberName" TEXT,
    "action" TEXT NOT NULL,
    "params" TEXT,
    "summary" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT,
    "requestedByName" TEXT,
    "resolvedById" TEXT,
    "resolvedNote" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayRecord_gymId_idx" ON "PayRecord"("gymId");

-- CreateIndex
CREATE INDEX "PayRecord_staffId_idx" ON "PayRecord"("staffId");

-- CreateIndex
CREATE INDEX "PayAdjustment_gymId_idx" ON "PayAdjustment"("gymId");

-- CreateIndex
CREATE INDEX "PayAdjustment_staffId_idx" ON "PayAdjustment"("staffId");

-- CreateIndex
CREATE INDEX "ProgressLog_gymId_memberId_idx" ON "ProgressLog"("gymId", "memberId");

-- CreateIndex
CREATE INDEX "ProgressLog_gymId_staffId_date_idx" ON "ProgressLog"("gymId", "staffId", "date");

-- CreateIndex
CREATE INDEX "CommunicationDelivery_communicationId_idx" ON "CommunicationDelivery"("communicationId");

-- CreateIndex
CREATE INDEX "CommunicationDelivery_gymId_memberId_idx" ON "CommunicationDelivery"("gymId", "memberId");

-- CreateIndex
CREATE INDEX "NotificationDismissal_staffId_idx" ON "NotificationDismissal"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDismissal_notificationId_staffId_key" ON "NotificationDismissal"("notificationId", "staffId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_gymId_status_idx" ON "ApprovalRequest"("gymId", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_memberId_idx" ON "ApprovalRequest"("memberId");

-- CreateIndex
CREATE INDEX "ActivityLog_gymId_createdAt_idx" ON "ActivityLog"("gymId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "Staff_gymId_idx" ON "Staff"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_gymId_code_key" ON "Product"("gymId", "code");

-- CreateIndex
CREATE INDEX "Communication_gymId_status_idx" ON "Communication"("gymId", "status");

-- AddForeignKey
ALTER TABLE "PayRecord" ADD CONSTRAINT "PayRecord_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRecord" ADD CONSTRAINT "PayRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRecord" ADD CONSTRAINT "PayRecord_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayAdjustment" ADD CONSTRAINT "PayAdjustment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayAdjustment" ADD CONSTRAINT "PayAdjustment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_workoutStaffId_fkey" FOREIGN KEY ("workoutStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeCard" ADD CONSTRAINT "TimeCard_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "Communication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDismissal" ADD CONSTRAINT "NotificationDismissal_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
