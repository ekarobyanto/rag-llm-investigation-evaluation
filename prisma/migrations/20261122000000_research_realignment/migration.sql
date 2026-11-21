-- Preserve all historical rows, action data, and scores. Null identity marks historical data.
ALTER TABLE "evaluation_scenarios" ALTER COLUMN "expectedActions" DROP NOT NULL;
ALTER TABLE "case_ground_truth" ALTER COLUMN "optimalNextActions" DROP NOT NULL;
ALTER TABLE "evaluation_scenarios" ADD COLUMN "datasetVersion" TEXT, ADD COLUMN "questionId" TEXT;
ALTER TABLE "ai_interaction_logs"
  ADD COLUMN "datasetVersion" TEXT, ADD COLUMN "runId" TEXT,
  ADD COLUMN "repetition" INTEGER, ADD COLUMN "attempt" INTEGER, ADD COLUMN "retryOf" TEXT,
  ADD COLUMN "status" TEXT, ADD COLUMN "failureReason" TEXT, ADD COLUMN "observationKey" TEXT,
  ADD COLUMN "referenceAnswerSnapshot" TEXT, ADD COLUMN "retrievalMetrics" JSONB,
  ADD COLUMN "modelSettings" JSONB, ADD COLUMN "runManifest" JSONB, ADD COLUMN "finishedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "ai_interaction_logs_observationKey_key" ON "ai_interaction_logs"("observationKey");
CREATE INDEX "ai_interaction_logs_run_dataset_idx" ON "ai_interaction_logs"("runId", "datasetVersion", "status");
CREATE UNIQUE INDEX "evaluation_scenarios_dataset_question_idx" ON "evaluation_scenarios"("datasetVersion", "questionId");
ALTER TABLE "ragas_evaluations" ADD COLUMN "evaluatorVersion" TEXT, ADD COLUMN "judgeModel" TEXT,
  ADD COLUMN "status" TEXT, ADD COLUMN "metricStatus" JSONB;
-- Use the same unstemmed configuration at indexing and query time for the Indonesian corpus.
CREATE OR REPLACE FUNCTION evidence_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_evidence_search_vector ON evidence;
CREATE TRIGGER trg_evidence_search_vector BEFORE INSERT OR UPDATE OF content ON evidence
FOR EACH ROW EXECUTE FUNCTION evidence_search_vector_trigger();
UPDATE evidence SET search_vector = to_tsvector('simple', content);
CREATE INDEX IF NOT EXISTS idx_evidence_search_vector ON evidence USING GIN (search_vector);
