# Experimental case and scenario design

The benchmark uses **The Nexus Data Breach**, one synthetic case with 150 evidence
records and 30 questions (10 easy, 12 medium, 8 hard). These are 30 queries over
one case, not 30 independently sampled cases. Difficulty labels are retained
from the original dataset; they are not independently validated hop counts.

## Audited scenarios: nexus-ragas-v2

`eval-scenarios/scenarios.json` replaces the original reference answers following
an AI-assisted internal evidence audit. Each row has a stable review identifier
in `notes`, from `nexus-ragas-v2/Q01` through `Q30`. This is not independent human
validation. The file retains the existing importer schema and zero-based evidence
indices; it adds no fields that the database importer would silently ignore.

The case evidence is **unchanged** in this revision. The references now distinguish
records, inferences, and unresolved questions. Marcus is the author-designated
culprit, but references evaluate what the supplied records actually support:

- Home occupancy and device/account activity do not independently identify a person.
- A NAS directory structure does not prove file-content identity.
- Cached marketplace pages do not prove who posted a listing.
- A wallet deposit is not a verified payment for stolen data.
- Viktor's bar visit ended before the breach began; it cannot cover the entire window.
- Lack of activity on one account/device does not conclusively eliminate a suspect.

### Known corpus inconsistencies

The ISP record (index 4) reports 142 Mbps for 2.5 hours, approximately 159.75 GB
using decimal units. The router record (index 11) reports 2.3 TB for the same
interval. References explicitly acknowledge this conflict instead of silently
inventing a corrected corpus. The actual occupancy record (index 3) ends at
05:35, not 05:30. Other corpus issues, including unspecified time zones, the
calendar weekday, and interpretive text in evidence, remain documented in
[the revision review](15-scenario-audit-v2.md).

## Scenario fields and scoring

- `requiredEvidenceIndices`: zero-based indices of relevant supporting records in
  `cases-input/case-1.json`. Despite the legacy field name, these are relevance
  labels, not a rule that every document is necessary for every valid answer.
  They are not yet an exhaustive independent annotation of all relevance.
- `referenceAnswer`: reviewed answer grounded in the current corpus. The Python
  RAGAS runner supplies this as `ground_truth`; faithfulness is evaluated against
  retrieved context, not by exact matching to this text. Recommendation correctness
  is a separate score, not factual answer correctness.
- `expectedActions`: accepted next-step targets/types for the existing recommendation
  scorer. Uncertain deductions accept examination or clarification rather than
  requiring a definitive submission.
- `expectedContradictions`: directly conflicting statement/record pairs. Marcus's
  occupancy and traffic are circumstantial challenges, so they are not labelled as
  direct logical contradictions. Viktor's departure/destination conflicts remain.
- `notes`: revision provenance and limitations. Audit notes and reference answers
  are evaluation metadata, not generation context.

`lib/rag.ts` currently uses a label-count-dependent retrieval budget: 8 for up to
5 labelled records, otherwise `min(20, max(10, labelCount + 2))`, unless a caller
supplies a limit. There is no fixed K=5 default in this path. Label changes can
therefore change the retrieval budget; record that budget when comparing runs.
Report results by dataset revision and query rather than mixing old/new runs.

## Offline validation

```sh
npm run eval:validate
npm run test:scenarios
```

These commands require Node.js but no database, API keys, embeddings, or model
calls. They check schema, references, contradiction endpoints, action targets,
and selected factual regressions. They do not establish empirical validity or
prove the completeness of semantic relevance labels.

## Applying the scenarios to a benchmark database

Changing JSON in Git does not update existing database rows. Use a **separate
benchmark database** containing the same 150 evidence records in source order
for the new evaluation version. On that isolated database, the existing scenario
seed/experiment flow can import these references, after offline validation.

Do not run `seed --force` against historical research data: it deletes case and
interaction records. Also, `lib/eval.ts:seedScenarios()` deletes existing scenario
rows; their old logs lose their scenario links (`onDelete: SetNull`). The normal
Prisma seed skips scenario import when any scenarios exist. None of those paths
is a version-preserving migration, so this PR does not execute them against the
live application. Preserve the old database/results and rerun all three methods
on the same revised benchmark rather than regrading old responses against new
questions or mixing dataset versions.
