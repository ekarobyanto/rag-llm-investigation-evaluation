-- CreateTable
CREATE TABLE "deductions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "suspectId" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "correctSuspectId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deductions_sessionId_key" ON "deductions"("sessionId");

-- AddForeignKey
ALTER TABLE "deductions" ADD CONSTRAINT "deductions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
