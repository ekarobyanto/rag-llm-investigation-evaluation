# 11. Evaluation Pipeline

Sistem evaluasi terdiri dari dua komponen: **evaluasi deterministik** (TypeScript, real-time) dan **evaluasi RAGAS** (Python, batch).

## A. Evaluasi Deterministik (TypeScript)

**File implementasi:** `lib/eval.ts`, `lib/rag.ts`

### Metrik Retrieval

Dihitung di `evaluateRetrieval()` (`lib/rag.ts` line 44-76):

| Metrik | Formula | Keterangan |
|---|---|---|
| Precision | `hits / retrievedIds.length` | Proporsi dokumen relevan dari yang di-retrieve |
| Recall | `hits / relevantSet.size` | Proporsi dokumen relevan yang berhasil di-retrieve |
| Top-K Accuracy | `hits > 0` | Boolean: apakah ada dokumen relevan di top-K |
| Retrieval Success | `hits > 0` | Boolean: sama dengan Top-K Accuracy |

Dimana `hits` = jumlah dokumen di `retrievedIds` yang ada di `relevantSet` (ground truth `relevantEvidenceIds`).

### Metrik Correctness

Dihitung di `scoreRecommendation()` (`lib/rag.ts` line 78-106):
- Membandingkan `action_type` dan `target` dari structured recommendation dengan `optimalNextActions` dari ground truth
- Skor: `1.0` (cocok) atau `0.0` (tidak cocok)

### Metrik Latency

Dicatat di setiap interaksi:

| Metrik | Keterangan |
|---|---|
| `embeddingTimeMs` | Waktu generate embedding query (null untuk sparse) |
| `retrievalTimeMs` | Waktu total retrieval |
| `llmResponseTimeMs` | Waktu respons LLM |
| `totalResponseTimeMs` | `llmResponseTimeMs + retrievalTimeMs` |

### Evaluasi Skenario

Skenario evaluasi didefinisikan di `eval-scenarios/scenarios.json` dan di-seed ke database via API `POST /api/eval/scenarios`.

Setiap skenario berisi:
- `prompt`: Pertanyaan evaluasi
- `difficulty`: easy / medium / hard
- `requiredEvidenceIds`: Evidence yang harus di-retrieve
- `expectedActions`: Aksi yang diharapkan
- `expectedContradictions`: Kontradiksi yang diharapkan

Fungsi `runScenario()` (`lib/eval.ts` line 98-178):
1. Mengambil skenario dari database
2. Membuat sesi investigasi baru
3. Menjalankan `generateAIResponse()` dengan `requiredEvidenceIds` dan `expectedActions`
4. Menyimpan hasil ke `ai_interaction_logs`
5. Mengembalikan metrik

Fungsi `runAllScenarios()` (`lib/eval.ts` line 182-207):
- Menjalankan **semua skenario** untuk **setiap metode retrieval** (sparse, dense, hybrid)
- Iterasi: untuk setiap skenario → untuk setiap metode → `runScenario()`

### Agregasi Metrik

Fungsi `aggregateMetrics()` (`lib/eval.ts` line 221-262):
- Menghitung rata-rata per metode retrieval:
  - `avgCorrectness`, `avgPrecision`, `avgRecall`, `topKAccuracyRate`
  - `avgResponseTimeMs`, `avgTokens`, `totalCost`

## B. Evaluasi RAGAS (Python)

**File implementasi:** `eval-pipeline/run_ragas.py`

### Metrik RAGAS

| Metrik | Keterangan |
|---|---|
| Faithfulness | Seberapa setia jawaban terhadap context |
| Answer Relevance | Seberapa relevan jawaban terhadap pertanyaan |
| Context Precision | Seberapa presisi context yang di-retrieve |
| Context Recall | Seberapa lengkap context mencakup ground truth |

### Konfigurasi RAGAS

| Parameter | Nilai |
|---|---|
| LLM Judge | `gpt-4o-mini` (temperature=0) |
| Embedding Model (judge) | `text-embedding-3-small` |
| Library | RAGAS 0.2.7, LangChain 0.3.7 |

### Alur RAGAS

1. Fetch unevaluated logs dari `ai_interaction_logs` yang memiliki `scenarioId` tapi belum ada record di `ragas_evaluations`
2. Untuk setiap log, siapkan:
   - `question`: `userPrompt`
   - `answer`: `aiResponse`
   - `contexts`: `retrievedContextsList` (array of strings)
   - `ground_truth`: `referenceAnswer` dari `evaluation_scenarios`
3. Jalankan `ragas.evaluate()` dengan 4 metrik
4. Simpan hasil ke tabel `ragas_evaluations`

### Export Hasil

**File:** `eval-pipeline/export_results.py`

- Fetch gabungan metrik deterministik + RAGAS dari database
- Agregasi berdasarkan `retrieval_method`
- Export ke CSV dan JSON di `eval-pipeline/results/`

## C. Penyimpanan Hasil Evaluasi

| Data | Tabel | Keterangan |
|---|---|---|
| Metrik retrieval (precision, recall) | `ai_interaction_logs` | Per interaksi |
| Metrik timing (latency) | `ai_interaction_logs` | Per interaksi |
| Token usage & cost | `ai_interaction_logs` | Per interaksi |
| Correctness score | `ai_interaction_logs` | Per interaksi |
| RAGAS metrics | `ragas_evaluations` | Per interaksi (1:1 dengan log) |
| Aggregated results | Computed on-the-fly | Via `aggregateMetrics()` atau `export_results.py` |
