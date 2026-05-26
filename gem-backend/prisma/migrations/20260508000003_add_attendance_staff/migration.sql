ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "staffId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Attendance_staffId_fkey' AND table_name = 'Attendance'
  ) THEN
    ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_staffId_fkey"
      FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
