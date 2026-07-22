# 16. Configuration Summary

| Component | Value | Source |
|---|---|---|
| Embedding Model | `text-embedding-3-small` | `lib/embedding.ts` line 9 |
| Chat Model | `gpt-4o` | `lib/rag.ts` line 163 |
| Chunk Size | Not Implemented (evidence stored as whole documents) | — |
| Chunk Overlap | Not Implemented | — |
| Top K | 5 | `lib/rag.ts` line 120, retriever defaults |
| Vector Similarity | Cosine Distance (`<=>` operator) | `lib/retrieval/dense.ts` line 30 |
| Embedding Dimensions | 1536 | `prisma/schema.prisma` line 47 |
| HNSW M | Not Found (pgvector default: 16) | — |
| HNSW ef_construction | Not Found (pgvector default: 64) | — |
| HNSW ef_search | Not Found (pgvector default: 40) | — |
| FTS Language | `'english'` | `lib/retrieval/sparse.ts` line 25 |
| FTS Ranking | `ts_rank_cd` (Cover Density) | `lib/retrieval/sparse.ts` line 25 |
| FTS Index | GIN on `search_vector` | `manual_sparse_dense_hybrid.sql` |
| RRF k | 60 | `lib/retrieval/hybrid.ts` line 21 |
| RRF Fusion Method | `"rrf"` (default) | `lib/retrieval/hybrid.ts` line 20 |
| Weighted Sum (sparse) | 0.3 | `lib/retrieval/hybrid.ts` line 22 |
| Weighted Sum (dense) | 0.7 | `lib/retrieval/hybrid.ts` line 23 |
| Over-fetch Factor | 2× (limit × 2) | `lib/retrieval/hybrid.ts` line 19 |
| Temperature | 0.2 | `lib/rag.ts` line 168 |
| Max Tokens | 1000 | `lib/rag.ts` line 169 |
| Prompt Template Version | `"v1"` | `lib/rag.ts` line 10 |
| Database | PostgreSQL (ankane/pgvector:latest) | `docker-compose.yml` |
| Database Name | `thesis` | `docker-compose.yml` line 13 |
| Database Port | 5433 (mapped to 5432) | `docker-compose.yml` line 15 |
| ORM | Prisma 5.11 | `package.json` |
| Framework | Next.js 15 (App Router) | `package.json` |
| RAGAS Version | 0.2.7 | `eval-pipeline/requirements.txt` |
| RAGAS LLM Judge | `gpt-4o-mini` (temperature=0) | `eval-pipeline/run_ragas.py` line 102 |
| RAGAS Embedding Judge | `text-embedding-3-small` | `eval-pipeline/run_ragas.py` line 103 |
| Cost Rate (Input) | $2.50 per 1M tokens | `lib/rag.ts` line 13 |
| Cost Rate (Output) | $10.00 per 1M tokens | `lib/rag.ts` line 14 |
| Number of Cases | 3 | `cases-input/case-1.json` |
| Number of Evidence | 60 (20 per case) | `cases-input/case-1.json` |
| Number of Suspects | 12 (4 per case) | `cases-input/case-1.json` |
| Number of Eval Scenarios | 9 | `eval-scenarios/scenarios.json` |
| Streaming | No (non-streaming) | `lib/rag.ts` line 162-170 |
| Reranking | Not Implemented | — |
| Chunking | Not Implemented | — |
