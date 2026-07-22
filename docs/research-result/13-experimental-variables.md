# 13. Experimental Variables

## Independent Variable (Variabel Bebas)

**Metode Retrieval** — Yang berubah antar eksperimen adalah metode retrieval yang digunakan.

Tiga metode yang dibandingkan:

| Metode | Deskripsi Implementasi | File |
|---|---|---|
| Sparse | PostgreSQL Full-Text Search (`tsvector` + `ts_rank_cd`) | `lib/retrieval/sparse.ts` |
| Dense | pgvector cosine similarity (`<=>` operator + HNSW index) | `lib/retrieval/dense.ts` |
| Hybrid | RRF fusion dari sparse + dense | `lib/retrieval/hybrid.ts` |

Diimplementasikan sebagai parameter `retrievalMethod` yang diterima oleh `retrieve()` di `lib/retrieval/index.ts`.

## Dependent Variables (Variabel Terikat)

Metrik yang diukur:

### Metrik Retrieval (Deterministik)

| Metrik | Rumus | File |
|---|---|---|
| Retrieval Precision | `hits / total_retrieved` | `lib/rag.ts` line 70 |
| Retrieval Recall | `hits / total_relevant` | `lib/rag.ts` line 71 |
| Top-K Accuracy | `hits > 0` (boolean) | `lib/rag.ts` line 73 |

### Metrik Response (Deterministik)

| Metrik | Keterangan | File |
|---|---|---|
| Correctness Score | Match action_type + target vs ground truth (0.0 atau 1.0) | `lib/rag.ts` line 78-106 |
| Total Response Time (ms) | `retrievalTimeMs + llmResponseTimeMs` | `lib/rag.ts` line 173 |
| Embedding Time (ms) | Waktu generate embedding query | `lib/retrieval/dense.ts` line 24 |
| Retrieval Time (ms) | Waktu retrieval total | Semua retriever |
| LLM Response Time (ms) | Waktu respons dari OpenAI API | `lib/rag.ts` line 172 |
| Token Usage | prompt_tokens, completion_tokens, total_tokens | `lib/rag.ts` line 179-181 |
| Estimated Cost ($) | Berdasarkan tarif GPT-4o | `lib/rag.ts` line 182 |

### Metrik RAGAS (LLM-based)

| Metrik | File |
|---|---|
| Faithfulness | `eval-pipeline/run_ragas.py` |
| Answer Relevance | `eval-pipeline/run_ragas.py` |
| Context Precision | `eval-pipeline/run_ragas.py` |
| Context Recall | `eval-pipeline/run_ragas.py` |

## Controlled Variables (Variabel Kontrol)

Yang tetap konstan di semua eksperimen:

| Variabel | Nilai | File |
|---|---|---|
| Chat Model | `gpt-4o` | `lib/rag.ts` line 163 |
| Embedding Model | `text-embedding-3-small` | `lib/embedding.ts` line 9 |
| Temperature | 0.2 | `lib/rag.ts` line 168 |
| Max Tokens | 1000 | `lib/rag.ts` line 169 |
| Top-K | 5 | `lib/rag.ts` line 120 |
| System Prompt | Prompt template v1 | `lib/rag.ts` line 147-156 |
| Dataset | 3 kasus, 60 evidence, 9 skenario | `cases-input/`, `eval-scenarios/` |
| Embedding Dimensions | 1536 | `prisma/schema.prisma` line 47 |
| RRF Constant k | 60 | `lib/retrieval/hybrid.ts` line 21 |
| FTS Language | `'english'` | `lib/retrieval/sparse.ts` line 25 |
| Database | PostgreSQL (ankane/pgvector) | `docker-compose.yml` |
| RAGAS LLM Judge | `gpt-4o-mini` | `eval-pipeline/run_ragas.py` line 102 |
