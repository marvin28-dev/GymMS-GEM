-- CreateIndex
CREATE INDEX "Member_gymId_createdAt_idx" ON "Member"("gymId", "createdAt");

-- CreateIndex
CREATE INDEX "Member_coachId_idx" ON "Member"("coachId");

-- CreateIndex
CREATE INDEX "Package_gymId_idx" ON "Package"("gymId");

-- CreateIndex
CREATE INDEX "Payment_gymId_createdAt_idx" ON "Payment"("gymId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_memberId_idx" ON "Payment"("memberId");

-- CreateIndex
CREATE INDEX "Sale_gymId_createdAt_idx" ON "Sale"("gymId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "Attendance_gymId_checkIn_idx" ON "Attendance"("gymId", "checkIn");

-- CreateIndex
CREATE INDEX "Attendance_memberId_idx" ON "Attendance"("memberId");

-- CreateIndex
CREATE INDEX "Task_gymId_status_idx" ON "Task"("gymId", "status");

-- CreateIndex
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");

-- CreateIndex
CREATE INDEX "Task_eventId_idx" ON "Task"("eventId");

-- CreateIndex
CREATE INDEX "Expense_gymId_date_idx" ON "Expense"("gymId", "date");

-- CreateIndex
CREATE INDEX "EquipmentIssue_gymId_status_idx" ON "EquipmentIssue"("gymId", "status");

-- CreateIndex
CREATE INDEX "TimeCard_gymId_staffId_date_idx" ON "TimeCard"("gymId", "staffId", "date");

-- CreateIndex
CREATE INDEX "CalendarEvent_gymId_date_idx" ON "CalendarEvent"("gymId", "date");

-- CreateIndex
CREATE INDEX "Notification_gymId_createdAt_idx" ON "Notification"("gymId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_staffId_idx" ON "Notification"("staffId");
