-- AlterTable
ALTER TABLE "ai_interaction_logs" ADD COLUMN     "retrievalPrecision" DOUBLE PRECISION,
ADD COLUMN     "retrievalRecall" DOUBLE PRECISION,
ADD COLUMN     "scenarioId" TEXT,
ADD COLUMN     "topKAccuracy" BOOLEAN;

-- CreateTable
CREATE TABLE "evaluation_scenarios" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "requiredEvidenceIds" JSONB NOT NULL,
    "expectedActions" JSONB NOT NULL,
    "expectedContradictions" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_scenarios_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ai_interaction_logs" ADD CONSTRAINT "ai_interaction_logs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "evaluation_scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_scenarios" ADD CONSTRAINT "evaluation_scenarios_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
