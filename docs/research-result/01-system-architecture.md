# 1. Overall System Architecture

Sistem ini dibangun sebagai aplikasi web full-stack yang menggabungkan simulasi investigasi interaktif berbasis RAG (Retrieval-Augmented Generation) dengan pipeline evaluasi otomatis untuk membandingkan tiga metode retrieval.

## Komponen Utama

| Komponen | Teknologi | File Implementasi |
|---|---|---|
| Frontend Framework | Next.js 15 (App Router, React 19) | `app/page.tsx`, `app/layout.tsx` |
| Backend / API | Next.js API Routes (Server-side) | `app/api/` |
| Database | PostgreSQL (via Docker `ankane/pgvector`) | `docker-compose.yml` |
| ORM | Prisma 5.11 | `prisma/schema.prisma` |
| Vector Database | pgvector extension (dalam PostgreSQL) | `prisma/migrations/manual_sparse_dense_hybrid.sql` |
| LLM Provider | OpenAI API | `lib/rag.ts` |
| Chat Model | `gpt-4o` | `lib/rag.ts` (line 163) |
| Embedding Model | `text-embedding-3-small` | `lib/embedding.ts` (line 9) |
| Retrieval Pipeline | Sparse / Dense / Hybrid (switchable) | `lib/retrieval/` |
| Evaluation Pipeline | TypeScript (deterministic) + Python RAGAS | `lib/eval.ts`, `eval-pipeline/` |

## Alur Data (Data Flow)

Alur data dari pertanyaan pemain hingga respons AI:

1. **Player Question** — Pemain mengetik pertanyaan melalui frontend (`InvestigationDashboard.tsx`)
2. **API Request** — Frontend mengirim POST ke `/api/ai/interact` dengan `prompt`, `caseId`, `sessionId`, dan `retrievalMethod`
3. **Retrieval** — Fungsi `retrieve()` di `lib/retrieval/index.ts` memanggil retriever sesuai metode yang dipilih:
   - `sparse` → `sparseRetrieve()` menggunakan PostgreSQL Full-Text Search
   - `dense` → `denseRetrieve()` menggunakan pgvector cosine similarity
   - `hybrid` → `hybridRetrieve()` menjalankan keduanya secara paralel lalu menggabungkan dengan RRF
4. **Context Assembly** — Hasil retrieval diformat menjadi string context bertipe `RELEVANT EVIDENCE:\n- [type/category] content` di `lib/rag.ts` (line 137-145)
5. **Prompt Construction** — System prompt + user prompt (context + question) dikirim ke OpenAI
6. **LLM Response** — OpenAI `gpt-4o` menghasilkan respons + structured recommendation dalam tag `<recommendation>`
7. **Evaluation** — Retrieval dievaluasi terhadap ground truth (precision, recall, top-K accuracy) di `lib/rag.ts` (line 44-76)
8. **Logging** — Semua data (prompt, response, metrik, timing, token, cost) disimpan ke tabel `ai_interaction_logs` via Prisma
9. **Response** — Frontend menampilkan respons AI beserta metrik retrieval
