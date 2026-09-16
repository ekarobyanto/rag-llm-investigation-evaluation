-- 1. Add referenceAnswer to evaluation_scenarios
ALTER TABLE "evaluation_scenarios" ADD COLUMN IF NOT EXISTS "referenceAnswer" TEXT;

-- 2. Update investigation_sessions for retrievalMethod
ALTER TABLE "investigation_sessions" ADD COLUMN IF NOT EXISTS "retrieval_method" TEXT NOT NULL DEFAULT 'dense';
ALTER TABLE "investigation_sessions" DROP COLUMN IF EXISTS "ragEnabled";

-- 3. Update ai_interaction_logs for hybrid search & telemetry
ALTER TABLE "ai_interaction_logs" ADD COLUMN IF NOT EXISTS "retrievedContextsList" JSONB;
ALTER TABLE "ai_interaction_logs" ADD COLUMN IF NOT EXISTS "retrieval_method" TEXT NOT NULL DEFAULT 'dense';
ALTER TABLE "ai_interaction_logs" ADD COLUMN IF NOT EXISTS "sparseScores" JSONB;
ALTER TABLE "ai_interaction_logs" ADD COLUMN IF NOT EXISTS "denseScores" JSONB;
ALTER TABLE "ai_interaction_logs" ADD COLUMN IF NOT EXISTS "fusionScores" JSONB;
ALTER TABLE "ai_interaction_logs" ADD COLUMN IF NOT EXISTS "fusion_method" TEXT;
ALTER TABLE "ai_interaction_logs" ADD COLUMN IF NOT EXISTS "embedding_time_ms" INTEGER;
ALTER TABLE "ai_interaction_logs" DROP COLUMN IF EXISTS "ragEnabled";

-- 4. Evidence tsvector column for sparse / hybrid search
ALTER TABLE "evidence" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- 5. Create ragas_evaluations table
CREATE TABLE IF NOT EXISTS "ragas_evaluations" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "faithfulness" DOUBLE PRECISION,
    "answerRelevance" DOUBLE PRECISION,
    "contextPrecision" DOUBLE PRECISION,
    "contextRecall" DOUBLE PRECISION,
    "faithfulnessReasoning" TEXT,
    "answerRelevanceReasoning" TEXT,
    "contextPrecisionReasoning" TEXT,
    "contextRecallReasoning" TEXT,
    "critique" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ragas_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ragas_evaluations_logId_key" ON "ragas_evaluations"("logId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ragas_evaluations_logId_fkey'
    ) THEN
        ALTER TABLE "ragas_evaluations" ADD CONSTRAINT "ragas_evaluations_logId_fkey" 
        FOREIGN KEY ("logId") REFERENCES "ai_interaction_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 6. Setup full-text search triggers and indices on evidence
UPDATE "evidence" SET "search_vector" = to_tsvector('english', "content") WHERE "search_vector" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_evidence_search_vector" ON "evidence" USING GIN ("search_vector");

CREATE OR REPLACE FUNCTION evidence_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evidence_search_vector ON evidence;
CREATE TRIGGER trg_evidence_search_vector
BEFORE INSERT OR UPDATE OF content ON evidence
FOR EACH ROW EXECUTE FUNCTION evidence_search_vector_trigger();
