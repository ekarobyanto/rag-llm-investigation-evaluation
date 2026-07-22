# 7. Dense Retrieval Implementation

**File implementasi:** `lib/retrieval/dense.ts`

## Konfigurasi pgvector

| Parameter | Nilai |
|---|---|
| Ekstensi | pgvector |
| Dimensi vektor | 1536 |
| Similarity metric | Cosine distance (`<=>` operator) |
| Index type | HNSW |
| Index operator class | `vector_cosine_ops` |
| Top-K | 5 (default, configurable via `options.limit`) |

## HNSW Index

```sql
-- prisma/migrations/manual_sparse_dense_hybrid.sql
CREATE INDEX IF NOT EXISTS idx_evidence_embedding ON evidence USING hnsw (embedding vector_cosine_ops);
```

**Catatan:** Parameter HNSW `m` dan `ef_construction` **tidak secara eksplisit dikonfigurasi** dalam source code. PostgreSQL/pgvector menggunakan nilai default:
- `m`: 16 (default pgvector)
- `ef_construction`: 64 (default pgvector)

## Vector Search Query

```sql
SELECT id, type, category,
  LEFT(content, 500) AS content,
  1 - (embedding <=> ${embeddingStr}::vector) AS similarity
FROM evidence
WHERE case_id = ${caseId}
  AND embedding IS NOT NULL
ORDER BY embedding <=> ${embeddingStr}::vector
LIMIT ${limit}
```

**Penjelasan:**
- `<=>`: Operator cosine distance dari pgvector
- `1 - (embedding <=> ...)`: Konversi dari cosine distance ke cosine similarity (semakin tinggi = semakin mirip)
- `ORDER BY embedding <=> ...`: Sort ascending by distance (nearest first)
- `LEFT(content, 500)`: Membatasi konten yang dikembalikan ke 500 karakter

## Alur Kerja Dense Retrieval

1. Query pemain dikonversi ke embedding menggunakan `generateEmbedding(query)` via OpenAI `text-embedding-3-small`
2. Waktu embedding dicatat (`embeddingTimeMs`)
3. Embedding di-serialize ke JSON string
4. Raw SQL query dijalankan via Prisma `$queryRaw` untuk mencari evidence terdekat
5. Hasil dikonversi ke array `RetrievedEvidenceItem` dengan skor `similarity`

## Return Value

Fungsi mengembalikan `RetrievalResult` berisi:
- `evidence`: Array `RetrievedEvidenceItem` (id, type, category, content, score = similarity, denseScore)
- `retrievalTimeMs`: Total waktu (embedding + vector search) dalam milidetik
- `embeddingTimeMs`: Waktu embedding saja dalam milidetik
- `method`: `"dense"`
- `denseScores`: Array skor dense (cosine similarity) per evidence
