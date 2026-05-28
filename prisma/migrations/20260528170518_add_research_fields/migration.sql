-- AlterTable
ALTER TABLE "ai_interaction_logs" ADD COLUMN     "estimatedCost" DOUBLE PRECISION,
ADD COLUMN     "promptTemplateVersion" TEXT NOT NULL DEFAULT 'v1',
ADD COLUMN     "retrievalScores" JSONB,
ADD COLUMN     "retrievalSuccess" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retrievedEvidenceIds" JSONB,
ADD COLUMN     "structuredRecommendation" JSONB;

-- AlterTable
ALTER TABLE "evidence" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'general',
ADD COLUMN     "difficultyWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- CreateTable
CREATE TABLE "case_ground_truth" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "correctSuspectId" TEXT NOT NULL,
    "contradictionPairs" JSONB NOT NULL,
    "relevantEvidenceIds" JSONB NOT NULL,
    "optimalNextActions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_ground_truth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_ground_truth_caseId_key" ON "case_ground_truth"("caseId");

-- AddForeignKey
ALTER TABLE "case_ground_truth" ADD CONSTRAINT "case_ground_truth_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_ground_truth" ADD CONSTRAINT "case_ground_truth_correctSuspectId_fkey" FOREIGN KEY ("correctSuspectId") REFERENCES "suspects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
