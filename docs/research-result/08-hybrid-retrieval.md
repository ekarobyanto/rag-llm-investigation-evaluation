# 8. Hybrid Retrieval Implementation

**File implementasi:** `lib/retrieval/hybrid.ts`

## Mekanisme Penggabungan

Hybrid retrieval menggabungkan hasil sparse dan dense retrieval. Kedua retrieval dijalankan **secara paralel** menggunakan `Promise.all()`.

```typescript
const [sparseResult, denseResult] = await Promise.all([
  sparseRetrieve(caseId, query, { limit: overFetch }),
  denseRetrieve(caseId, query, { limit: overFetch }),
])
```

**Over-fetching:** Setiap retriever mengambil `limit * 2` dokumen untuk memastikan cakupan yang lebih luas sebelum fusion.

## Reciprocal Rank Fusion (RRF) Implementation

### Parameter RRF

| Parameter | Nilai Default | File |
|---|---|---|
| RRF constant (k) | 60 | `lib/retrieval/hybrid.ts` line 21 |
| Fusion method | `"rrf"` | `lib/retrieval/hybrid.ts` line 20 |
| Sparse weight (for weighted_sum) | 0.3 | `lib/retrieval/hybrid.ts` line 22 |
| Dense weight (for weighted_sum) | 0.7 | `lib/retrieval/hybrid.ts` line 23 |

### Formula RRF

```
RRF(d) = 1/(k + rank_sparse(d)) + 1/(k + rank_dense(d))
```

Implementasi (line 72-78):
```typescript
if (fusionMethod === "rrf") {
  for (const c of candidates) {
    c.item.fusionScore = 1 / (rrf_k + c.sparseRank) + 1 / (rrf_k + c.denseRank)
    c.item.score = c.item.fusionScore
  }
}
```

### Penalty Rank

Dokumen yang hanya muncul di satu retriever mendapat **penalty rank** = `overFetch + 1` (yaitu `limit * 2 + 1`) untuk retriever yang tidak mengembalikan dokumen tersebut.

```typescript
const penaltyRank = overFetch + 1  // line 37
```

## Metode Fusion Alternatif: Weighted Sum

Selain RRF, sistem juga mendukung **weighted sum** dengan min-max normalization:

```typescript
// Min-max normalization + weighted sum
const normSparse = c.sparseScore / maxSparse
const normDense = c.denseScore / maxDense
c.item.fusionScore = sparseWeight * normSparse + denseWeight * normDense
```

Default weights: sparse = 0.3, dense = 0.7

## Reranking

**Reranking TIDAK diimplementasikan.** Setelah fusion scoring, dokumen di-sort descending berdasarkan fusion score dan top-K diambil langsung tanpa reranking tambahan.

## Alur Kerja Hybrid Retrieval

1. Jalankan `sparseRetrieve()` dan `denseRetrieve()` secara paralel dengan over-fetch (limit × 2)
2. Bangun `candidateMap` dari semua dokumen unik
3. Assign rank sparse dan dense ke setiap dokumen (penalty rank untuk dokumen yang tidak ditemukan oleh salah satu retriever)
4. Hitung fusion score menggunakan RRF (default) atau weighted sum
5. Sort candidates descending berdasarkan fusion score
6. Ambil top-K dokumen

## Return Value

- `evidence`: Array top-K `RetrievedEvidenceItem` (id, type, category, content, score = fusionScore, sparseScore, denseScore, fusionScore)
- `retrievalTimeMs`: Total waktu (termasuk sparse + dense + fusion) dalam milidetik
- `embeddingTimeMs`: Waktu embedding (dari dense retrieval)
- `method`: `"hybrid"`
- `sparseScores`, `denseScores`, `fusionScores`: Array skor per evidence
- `fusionMethod`: `"rrf"` atau `"weighted_sum"`
