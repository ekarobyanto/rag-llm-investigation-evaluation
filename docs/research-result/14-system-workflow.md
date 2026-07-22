# 14. System Workflow

## Alur Kerja Saat Pemain Mengajukan Pertanyaan

### Step-by-Step Workflow

1. **Player Question**
   - Pemain mengetik pertanyaan di `InvestigationDashboard.tsx`
   - Frontend mengirim POST request ke `/api/ai/interact`
   - Payload: `{ sessionId, caseId, prompt, retrievalMethod }`

2. **API Route Handler** (`app/api/ai/interact/route.ts`)
   - Validasi `retrievalMethod` (harus `sparse`, `dense`, atau `hybrid`)
   - Memanggil `generateAIResponse()` dari `lib/rag.ts`

3. **Retrieval** (`lib/retrieval/index.ts` → method-specific retriever)
   - **Sparse:** Query `plainto_tsquery` → fallback `websearch_to_tsquery` → `ts_rank_cd` → top-K
   - **Dense:** `generateEmbedding(query)` → `embedding <=> query_vector` → cosine similarity → top-K
   - **Hybrid:** Parallel sparse + dense (over-fetch 2×) → RRF fusion → top-K
   - Output: `RetrievalResult` (evidence array, scores, timing)

4. **Retrieval Evaluation** (`lib/rag.ts` → `evaluateRetrieval()`)
   - Bandingkan `retrievedEvidenceIds` dengan `relevantEvidenceIds` dari ground truth
   - Hitung precision, recall, topKAccuracy

5. **Context Assembly** (`lib/rag.ts` line 137-145)
   - Format evidence: `RELEVANT EVIDENCE:\n- [type/category] content`
   - Ambil 5 interaksi terakhir sebagai `INVESTIGATION HISTORY`

6. **Prompt Construction** (`lib/rag.ts` line 147-158)
   - System prompt: expert criminal investigation assistant + recommendation format
   - User prompt: retrieved context + player question

7. **LLM Call** (`lib/rag.ts` line 162-170)
   - `openai.chat.completions.create()` dengan `gpt-4o`, temperature 0.2, max_tokens 1000
   - Non-streaming

8. **Response Processing** (`lib/rag.ts` line 175-191)
   - Extract structured recommendation dari tag `<recommendation>`
   - Strip recommendation tags untuk human response
   - Score recommendation vs ground truth
   - Calculate cost estimation

9. **Logging** (`app/api/ai/interact/route.ts` line 20-53)
   - Simpan seluruh data ke `ai_interaction_logs`:
     - Prompt, response, context
     - Retrieval metrics (precision, recall, top-K)
     - Individual scores (sparse, dense, fusion)
     - Timing (embedding, retrieval, LLM, total)
     - Token usage, cost
     - Correctness score

10. **Response to Frontend**
    - Return: `{ response, structuredRecommendation, logId, timings, tokens, estimatedCost, correctnessScore, retrievalMethod }`

## Alur Evaluasi Batch

1. **Seed Scenarios**: `POST /api/eval/scenarios` → `seedScenarios()` → read `eval-scenarios/scenarios.json` → insert ke `evaluation_scenarios`
2. **Run All**: `POST /api/eval/run` → `runAllScenarios()` → untuk setiap skenario × setiap metode → `runScenario()` → `generateAIResponse()`
3. **View Results**: `GET /api/eval/results` → `aggregateMetrics()` → aggregate per method
4. **RAGAS (Optional)**: `python eval-pipeline/run_ragas.py` → fetch unevaluated logs → run RAGAS → save to `ragas_evaluations`
5. **Export (Optional)**: `python eval-pipeline/export_results.py` → combined metrics → CSV/JSON
