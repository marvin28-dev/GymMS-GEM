-- AlterTable
ALTER TABLE "PayRecord" ADD COLUMN     "expenseId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "receipt" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PayRecord_expenseId_key" ON "PayRecord"("expenseId");

-- AddForeignKey
ALTER TABLE "PayRecord" ADD CONSTRAINT "PayRecord_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

