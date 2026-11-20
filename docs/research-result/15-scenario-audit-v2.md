# Review of the October 2026 scenario audit

## Outcome

The audit's central findings are supported by the JSON source, which matches the
Drive files used for the report. Its proposed patch was **not ready to copy
verbatim**. This revision rechecks the answers against the unchanged corpus and
corrects remaining support gaps in all 30 audited scenarios, stored separately in
`eval-scenarios/scenario-v2.json`.

The revision is scenario-only: it does not manufacture IP assignments, recovered
file hashes, seller logs, or a source for the cryptocurrency deposit. It preserves
150 evidence records and the 10/12/8 difficulty distribution. The original scenario
definitions remain unchanged in `eval-scenarios/scenarios.json`. Offline validation
and regression tests read the audited V2 file; seed paths continue to read V1.

## Corrections to the audit itself

1. **Retrieval budget:** the K=5 ceiling in the report was conditional. The current
   generator already selects an adaptive limit of 8–20. This revision does not
   increase that limit or claim recall is currently capped at 27.8%.
2. **Action aliases:** `normalizeActionType()` already maps `INTERROGATE_SUSPECT`
   to `INTERROGATE`. The spelling difference is not a demonstrated runtime failure.
3. **Leakage:** the inspected generation path builds context from retrieved
   evidence and investigation history, not suspect profiles or case ground truth.
   Profile tags remain visible in the application dataset, but the report did not
   establish that they leak into this benchmark's generation request. Evidence
   itself still includes some author interpretation, notably index 135.
4. **Proposed references still needed labels:** the audit's Q19 correction
   mentions the bar ending before the breach without labelling the bar/GPS
   evidence. Its Q27 reference mentions Marcus's sleep account without index 2.
   These are now included. Q10's contextual cryptocurrency answer includes its
   communication/search records as well as the deposit.
5. **Fixed narrative vs data repair:** changing 2.3 TB to 160 GB is a possible
   author revision, not an observed correction to the live evidence. This patch
   retains both conflicting records and explicitly identifies their inconsistency.
6. **Uncertainty should not force conviction:** direct-contradiction expectations
   for Marcus were removed; uncertain final analyses accept examination or
   clarification rather than requiring `SUBMIT_DEDUCTION`.

## Per-question changes

Indices below are zero-based, exactly as in JSON.

| Question | Main revision |
| --- | --- |
| Q01 | Identifies the flight without asserting an independently verified airborne alibi throughout an unspecified time zone. |
| Q02 | Asks about documented access/tools; no absolute claim of technical incapability. |
| Q03 | Keeps the account and creator facts; creation does not identify the breach operator. |
| Q04 | Adds Sarah's own departure statement (31); distinguishes the answer from journey corroboration. |
| Q05 | Keeps role/credential management and supporting rotation/review records (84, 85). |
| Q06 | Separates potential career/financial motive from an unverified transaction; includes colleague and Signal context (9, 15). |
| Q07 | Includes the legitimate download (99), preventing read-only access from becoming a blanket impossibility claim. |
| Q08 | Adds the payment record (122); removes inferred sleep. |
| Q09 | Adds repository/reset records (13, 19); describes administrative control without proving use during the breach. |
| Q10 | Labels email, deposit, Signal, and crypto-search records (6, 7, 15, 21); no verified payment-source claim. |
| Q11 | Corrects 05:35 and order time; qualifies occupancy, GPS, and streaming. Removes circumstantial pair from direct contradictions. |
| Q12 | Includes origin, guard, and phone context (0, 36, 39); Sarah's departure precedes the breach. Does not exclude alternate devices/accounts. |
| Q13 | Corrects session end vs login and the bar chronology; removes invented embarrassment motive. Adds direct destination conflicts. |
| Q14 | Compares support across suspects rather than pretending motive plus access uniquely identifies Marcus. Includes Viktor's access/income and Sarah's forensics. |
| Q15 | Narrows scope to business/transaction contacts; no unidentified buyer asserted and no competitor delivery inferred from forwarding to oneself. |
| Q16 | Replaces definitive elimination with evidence weakening a hypothesis and its limitations. |
| Q17 | Reports a deposit, not proven proceeds; uses the $2.1 million contract figure. Removes unrelated incapability claim. |
| Q18 | Uses latest documented reset and outside schedule, not unauthorized. |
| Q19 | Adds bar/GPS labels (65, 66); explicitly says the bar visit ended before the breach. |
| Q20 | Recruitment and motive remain interpretations; a call record does not reveal call content. |
| Q21 | Restricts negative claims to the records and >1 GB threshold; repository access does not prove tokens were used. |
| Q22 | Separates before/after artefacts from breach-night logs and explicitly calculates the transfer conflict. |
| Q23 | Replaces unsupported ALL/three-contradictions claim; labels direct Viktor pairs and distinguishes Marcus indicators. |
| Q24 | Removes invented Signal date, buyer identity, posting, and complete proven chain. Accepts follow-up investigation. |
| Q25 | Uses evidence-grounded clarification questions, 05:35, and actual rotation dates; removes unlabelled NAS/volume demands. |
| Q26 | Adds VPN/work-laptop labels (0, 17); order is not delivery, and device logs are not an observed personal timeline. |
| Q27 | Adds sleep statement (2); removes definitive elimination, operator identity, NAS copy, and intentionally clean laptop assertions. |
| Q28 | Grounds marketplace appearance in evidence 5 rather than assuming case-description context is sent to the model. |
| Q29 | Replaces a complete prosecution narrative with supported facts, inferences, and gaps. |
| Q30 | Adds missing statement, marketplace, and motive labels; concludes strongest implication with stated uncertainty. |

Each scenario retains review provenance in `notes`; `referenceAnswer` contains
answer text rather than instructions to the judge to award a particular score.
Relevant corroborating records are retained where useful; labels were not trimmed
merely to increase recall. A comprehensive sufficient-evidence-set scoring model
would require a separate evaluator/schema change.

## Remaining corpus and methodology issues

- Transfer rate/volume contradiction; unspecified time zones and missing transaction
  time; January 15, 2027 is Friday whereas evidence 59 calls it Monday.
- The source IP is not explicitly assigned to Marcus's residence in the evidence.
- October 15 quarterly rotation vs next scheduled February 1 needs policy context.
- Case profiles expose narrative roles to players; evidence 135 includes an author
  interpretation. These were not altered by a scenario-only correction.
- Difficulty labels, factual realism, and relevance completeness have not received
  independent human validation.
- Label-count-dependent retrieval budgets need reporting and consistent use across
  methods. Changing labels means old/new performance is not directly interchangeable.
- The Python RAGAS pipeline monkeypatches answer relevancy's noncommittal penalty.
  Its results should be described as the configured/customized metric, not assumed
  identical to unmodified RAGAS. This revision does not alter scoring.
- Scenario seeding is destructive to historical scenario links. See the separate
  benchmark database rollout in [the design document](14-case-and-scenarios.md).

No paid model evaluations, live database writes, deployments, or case reseeding
were performed to verify this revision. Offline tests check integrity and selected
regressions, not independent validation of the fictional case.
