# 5. Embedding Pipeline

## Embedding Model

| Parameter | Nilai |
|---|---|
| Model | `text-embedding-3-small` |
| Provider | OpenAI |
| Dimensi | 1536 |
| File implementasi | `lib/embedding.ts` |

## Implementasi

```typescript
// lib/embedding.ts
import { OpenAI } from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  })
  return response.data[0].embedding
}
```

## Dimana Embedding Dihasilkan

1. **Saat Seeding** (`prisma/seed.ts` line 148-158): Embedding dihasilkan untuk setiap evidence saat data di-seed ke database.
2. **Saat Query (Dense/Hybrid Retrieval)** (`lib/retrieval/dense.ts` line 22-24): Embedding dihasilkan untuk query pemain sebelum melakukan vector search.

## Dimana Embedding Disimpan

Embedding disimpan di kolom `embedding` pada tabel `evidence` dengan tipe data `vector(1536)` menggunakan ekstensi pgvector.

```sql
-- Prisma schema (prisma/schema.prisma line 47)
embedding  Unsupported("vector(1536)")? @map("embedding")
```

Penyimpanan dilakukan via raw SQL karena Prisma tidak mendukung tipe `vector` secara native:
```sql
-- prisma/seed.ts line 151-154
UPDATE evidence SET embedding = ${JSON.stringify(embedding)}::vector WHERE id = ${created.id}
```

## Kapan Embedding Diperbarui

Embedding hanya dihasilkan sekali saat proses seeding. Tidak ada mekanisme untuk memperbarui embedding setelah seeding, karena konten evidence bersifat statis.
