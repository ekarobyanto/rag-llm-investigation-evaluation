# 4. Knowledge Base Preparation

## Pembuatan Dokumen

Dokumen (evidence) dibuat secara manual dalam format JSON dan disimpan di direktori `cases-input/`. Setiap file JSON berisi satu atau lebih kasus lengkap.

**File:** `cases-input/case-1.json`

Struktur data per kasus:
```json
{
  "case": { "title": "...", "description": "..." },
  "suspects": [{ "name": "...", "profile": "..." }],
  "evidence": [
    {
      "type": "witness_statement",
      "category": "contradiction",
      "difficulty_weight": 0.9,
      "content": "Full text of the evidence..."
    }
  ],
  "ground_truth": {
    "correct_suspect_name": "...",
    "contradiction_pairs": [...],
    "relevant_evidence_indices": [...],
    "optimal_next_actions": [...]
  }
}
```

## Proses Seeding

Data di-load dan di-seed ke database menggunakan script `prisma/seed.ts` yang dijalankan via `npm run seed` (menggunakan `tsx`).

Langkah-langkah seeding:

1. Membaca semua file `.json` dari `cases-input/`
2. Menghapus semua data existing (`clearDatabase()`)
3. Untuk setiap kasus:
   - Membuat record `Case`
   - Membuat record `Suspect` untuk setiap tersangka
   - Membuat record `Evidence` untuk setiap bukti
   - Jika `OPENAI_API_KEY` tersedia: membuat embedding untuk setiap evidence menggunakan `generateEmbedding()` lalu menyimpan via raw SQL `UPDATE evidence SET embedding = ...::vector`
   - Membuat record `CaseGroundTruth` dengan mapping index ke ID database

**File implementasi:** `prisma/seed.ts`

## Chunking

**Chunking TIDAK diimplementasikan.** Setiap evidence disimpan sebagai satu dokumen utuh tanpa dipecah menjadi chunk. Tidak ada chunk size atau chunk overlap karena setiap evidence item sudah merupakan unit informasi atomik (satu pernyataan saksi, satu laporan forensik, dll).

## Metadata yang Disimpan

Setiap evidence menyimpan metadata berikut:

| Metadata | Keterangan |
|---|---|
| `type` | Tipe bukti: `witness_statement`, `forensic_report`, `cctv_log`, `financial_record`, `email_message`, `location_report` |
| `category` | Kategori bukti: `financial`, `alibi`, `contradiction`, `location`, `communication`, `motive`, `forensic`, `noise` |
| `difficultyWeight` | Bobot kesulitan (0.1 - 0.9) |
| `caseId` | Foreign key ke kasus |

## Preprocessing Pipeline

Preprocessing terjadi pada dua tahap:

1. **Embedding generation** — Saat seeding, konten evidence dikirim ke OpenAI `text-embedding-3-small` dan disimpan sebagai `vector(1536)` di kolom `embedding`.

2. **tsvector generation** — Melalui PostgreSQL trigger (`trg_evidence_search_vector`) yang didefinisikan di `prisma/migrations/manual_sparse_dense_hybrid.sql`:
   ```sql
   CREATE OR REPLACE FUNCTION evidence_search_vector_trigger()
   RETURNS trigger AS $$
   BEGIN
     NEW.search_vector := to_tsvector('english', NEW.content);
     RETURN NEW;
   END
   $$ LANGUAGE plpgsql;
   ```
   Trigger ini otomatis mengisi kolom `search_vector` setiap kali evidence di-insert atau di-update.
