-- Create vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 4. Populate search_vector for all existing evidence (if any)
UPDATE evidence SET search_vector = to_tsvector('english', content) WHERE search_vector IS NULL;

-- 5. Create GIN index for full-text search (sparse retrieval)
CREATE INDEX IF NOT EXISTS idx_evidence_search_vector ON evidence USING GIN (search_vector);

-- 6. Create HNSW index for vector search (dense retrieval) — significantly faster than linear scan
CREATE INDEX IF NOT EXISTS idx_evidence_embedding ON evidence USING hnsw (embedding vector_cosine_ops);

-- 7. Auto-update tsvector on insert/update via trigger
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
