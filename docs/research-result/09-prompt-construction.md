# 9. Prompt Construction

**File implementasi:** `lib/rag.ts`

## System Prompt

```
You are an expert criminal investigation assistant.

When responding, you MUST always end your response with a JSON block in this exact format:
<recommendation>
{
  "action_type": "INTERROGATE" | "EXAMINE_EVIDENCE" | "REVIEW_TIMELINE" | "SUBMIT_DEDUCTION" | "INVESTIGATE_LOCATION",
  "target": "<suspect name or evidence ID>",
  "reason": "<one sentence reason>"
}
</recommendation>
```

**Lokasi:** `lib/rag.ts` line 147-156

System prompt menginstruksikan LLM untuk:
1. Berperan sebagai asisten investigasi kriminal
2. Selalu mengakhiri respons dengan blok JSON terstruktur dalam tag `<recommendation>`
3. Memilih salah satu dari 5 tipe aksi: `INTERROGATE`, `EXAMINE_EVIDENCE`, `REVIEW_TIMELINE`, `SUBMIT_DEDUCTION`, `INVESTIGATE_LOCATION`

## User Prompt

User prompt dibangun dengan menggabungkan retrieved context dan pertanyaan pemain:

```typescript
// lib/rag.ts line 158
const userPrompt = `${retrievedContext}\n\nPlayer Question: ${prompt}`
```

## Retrieved Context Injection

Context dibangun dari dua sumber:

### 1. Retrieved Evidence (line 137-139)
```
RELEVANT EVIDENCE:
- [witness_statement/contradiction] David Vance stated: '...'
- [forensic_report/forensic] Digital forensic analysis reveals...
- [location_report/location] Badge reader logs show...
```

Format: `- [${e.type}/${e.category}] ${e.content}`

Jika tidak ada evidence yang di-retrieve: `RELEVANT EVIDENCE:\n(No evidence retrieved)`

### 2. Investigation History (line 141-143)
```
INVESTIGATION HISTORY:
Q: Who should be interrogated next?
A: Based on the evidence...

Q: What financial motive exists?
A: The financial records show...
```

History diambil dari 5 interaksi terakhir dalam sesi yang sama (`getInvestigationHistory()` line 22-42).

## Prompt Template Lengkap

```
[System]
You are an expert criminal investigation assistant.

When responding, you MUST always end your response with a JSON block in this exact format:
<recommendation>
{
  "action_type": "INTERROGATE" | "EXAMINE_EVIDENCE" | "REVIEW_TIMELINE" | "SUBMIT_DEDUCTION" | "INVESTIGATE_LOCATION",
  "target": "<suspect name or evidence ID>",
  "reason": "<one sentence reason>"
}
</recommendation>

[User]
RELEVANT EVIDENCE:
- [type/category] content...
- [type/category] content...

INVESTIGATION HISTORY:
Q: previous question
A: previous answer

Player Question: <actual player question>
```

## Prompt Template Version

Versi template disimpan sebagai `"v1"` (`PROMPT_TEMPLATE_VERSION` di `lib/rag.ts` line 10) dan dicatat di setiap log (`promptTemplateVersion`).
