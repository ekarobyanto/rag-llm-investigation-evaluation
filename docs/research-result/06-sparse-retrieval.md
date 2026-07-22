# 6. Sparse Retrieval Implementation

**File implementasi:** `lib/retrieval/sparse.ts`

## Konfigurasi PostgreSQL Full-Text Search

| Parameter | Nilai |
|---|---|
| Language configuration | `'english'` |
| tsvector column | `search_vector` (tabel `evidence`) |
| Ranking function | `ts_rank_cd` (Cover Density ranking) |
| Top-K | 5 (default, configurable via `options.limit`) |
| Index | GIN index pada `search_vector` |

## tsvector Generation

tsvector dihasilkan melalui PostgreSQL trigger yang didefinisikan di `prisma/migrations/manual_sparse_dense_hybrid.sql`:

```sql
CREATE OR REPLACE FUNCTION evidence_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evidence_search_vector
BEFORE INSERT OR UPDATE OF content ON evidence
FOR EACH ROW EXECUTE FUNCTION evidence_search_vector_trigger();
```

Untuk data existing:
```sql
UPDATE evidence SET search_vector = to_tsvector('english', content) WHERE search_vector IS NULL;
```

## Index

```sql
CREATE INDEX IF NOT EXISTS idx_evidence_search_vector ON evidence USING GIN (search_vector);
```

## tsquery Construction

Sistem menggunakan **dua tahap** pencarian:

### Tahap 1: `plainto_tsquery`
```sql
SELECT id, type, category,
  LEFT(content, 500) AS content,
  ts_rank_cd(search_vector, plainto_tsquery('english', ${query})) AS score
FROM evidence
WHERE case_id = ${caseId}
  AND search_vector IS NOT NULL
  AND search_vector @@ plainto_tsquery('english', ${query})
ORDER BY score DESC
LIMIT ${limit}
```

### Tahap 2: `websearch_to_tsquery` (Fallback)
Jika tahap 1 tidak mengembalikan hasil, sistem mencoba `websearch_to_tsquery` untuk matching yang lebih fleksibel:

```sql
SELECT id, type, category,
  LEFT(content, 500) AS content,
  ts_rank_cd(search_vector, websearch_to_tsquery('english', ${query})) AS score
FROM evidence
WHERE case_id = ${caseId}
  AND search_vector IS NOT NULL
  AND search_vector @@ websearch_to_tsquery('english', ${query})
ORDER BY score DESC
LIMIT ${limit}
```

## Ranking Function

`ts_rank_cd` (Cover Density Ranking) digunakan untuk scoring. Fungsi ini mempertimbangkan kepadatan (proximity) kata kunci dalam dokumen.

## Return Value

Fungsi mengembalikan `RetrievalResult` berisi:
- `evidence`: Array `RetrievedEvidenceItem` (id, type, category, content, score, sparseScore)
- `retrievalTimeMs`: Waktu retrieval dalam milidetik
- `embeddingTimeMs`: `null` (sparse retrieval tidak membutuhkan embedding)
- `method`: `"sparse"`
- `sparseScores`: Array skor sparse per evidence
