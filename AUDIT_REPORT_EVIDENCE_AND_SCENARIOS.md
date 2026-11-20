# Audit Report: Evidence Corpus & RAGAS Scenarios (v2)

> **Full Comprehensive Document:** [`docs/research-result/17-comprehensive-evidence-and-scenario-audit.md`](file:///E:/Project/rag-llm-investigation-evaluation/docs/research-result/17-comprehensive-evidence-and-scenario-audit.md)  
> **Audited Files:** `cases-input/case-1.json`, `eval-scenarios/scenario-v2.json`, `lib/eval.ts`, `prisma/seed.ts`, `eval-pipeline/run_ragas.py`  
> **Branch:** `fix/audited-ragas-scenarios`  
> **Commit Base:** `1578ec8`  

---

## Quick Navigation for Verifying Agents

This repository contains an audit and refinement of the evaluation benchmark for the RAG-LLM Investigation System.

For the exhaustive claim-by-claim and evidence-by-evidence audit report, please refer directly to:
👉 [**`docs/research-result/17-comprehensive-evidence-and-scenario-audit.md`**](file:///E:/Project/rag-llm-investigation-evaluation/docs/research-result/17-comprehensive-evidence-and-scenario-audit.md)

---

## Key Findings & Summary of Actions

### 1. Ingestion Pipeline Safety (Critical Fix)
- **Problem:** `lib/eval.ts` and `prisma/seed.ts` originally loaded all `*.json` files in `eval-scenarios/`. Having both `scenarios.json` (v1) and `scenario-v2.json` (v2) in that folder caused both files to be imported simultaneously, creating 60 duplicate scenario records in the database.
- **Fix:** Both loaders are now pinned to `process.env.EVAL_SCENARIO_FILE || "scenarios.json"`. To evaluate against v2, set `EVAL_SCENARIO_FILE=scenario-v2.json`.

### 2. Evidence Corpus Inconsistencies (`cases-input/case-1.json`)
Five intrinsic anomalies exist within the fictional evidence docket itself:
1. **Transfer Rate vs. Volume Conflict:** ISP line metadata (`[4]`, 142 Mbps over 2.5 hours $\approx 159.75\text{ GB}$) vs. Home router log (`[11]`, $2.3\text{ TB}$).
2. **Provisioning Authority Conflict:** Service account audit (`[1]`, Marcus created `svc-threatfeed`) vs. IT org records (`[60]`, Viktor provisions all service accounts).
3. **Rotation Timeline Inconsistency:** Quarterly rotation from Oct 15 (`[84]`) does not match the stated Feb 1 date (`[19]`).
4. **Calendar Day-of-Week Discrepancy:** Automated standup reminder (`[59]`) calls Jan 15, 2027 a "Monday" when it was a Friday.
5. **Residential IP Assignment Gap:** Breach VPN used IP `74.125.224.72` (`[0]`), but no ISP record maps this IP explicitly to Marcus Chen's residence.

Reference answers in `scenario-v2.json` explicitly acknowledge these conflicts rather than endorsing unverified assumptions.

### 3. Scenario Audit & Applied Refinements (`eval-scenarios/scenario-v2.json`)
- **Factual Integrity:** All 30 scenarios are strictly grounded in the 150 evidence records. All specific timestamps (e.g. `05:35`, `01:12`, `22:50`), dollar figures, and Ethereum amounts are verified accurate.
- **Specific Scenarios Refined:**
  - **Q11:** Dropped unreferenced noise food order label (`23`); explicitly noted Netflix streaming (`22`) continued until 23:25.
  - **Q12:** Corrected non-sequitur regarding Sarah's departure; corrected phone window to 02:15–06:45 (`39`).
  - **Q13:** Added contradiction pair `[61, 63]` (claimed 17:00 departure vs. 19:17 badge exit).
  - **Q14:** Added Aisha Rahman (`97`, `103`) to suspect comparison.
  - **Q15:** Removed unsupported prompt clause ("separating them from internal messages"); corrected citation for Sarah's attorney (`53`).
  - **Q17:** Corrected attribution on Meridian contract loss (`126`); added Viktor client invoice record (`87`).
  - **Q18:** Added record `60`; surfaced the corpus provisioning authority and rotation calendar contradictions.
  - **Q20:** Clarified that call to competitor CEO was documented in phone records, not an audio recording (`134`).
  - **Q22:** Narrowed prompt to breach-night network telemetry and recovered device artefacts.
  - **Q23:** Clarified that Netflix streaming ending at 23:25 is only a marginal challenge to Marcus's 23:00 sleep claim.
  - **Q26:** Stated the conflicting transfer figures (142 Mbps vs. 2.3 TB) explicitly.
  - **Q27:** Added home arrival records for Sarah (`38`), Viktor (`66`), and James (`124`) to suspect location cross-referencing.
  - **Q30:** Added Signal message (`15`) to support plural "communications".
  - **All Scenarios:** Prepended notes with clear stamp indicating findings refer to the original v1 item.

---

## Offline Verification Instructions for Next Agent

Run the offline verification suite:
```powershell
npm run eval:validate
npm run test:scenarios
npx tsc --noEmit -p .
```
All tests should pass (6/6 unit tests) with 0 errors.
