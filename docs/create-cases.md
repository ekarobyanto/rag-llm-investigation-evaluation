# Case Generation Specification

**Audience:** AI agent generating new investigation cases for the system.

**Goal:** Produce a complete case package — case description, suspects, evidence corpus, and ground truth — that meets the research requirements for retrieval-grounded LLM evaluation.

---

## 1. What You Must Produce

Every generated case is a single JSON object with **four** top-level sections:

```json
{
  "case": { ... },
  "suspects": [ ... ],
  "evidence": [ ... ],
  "ground_truth": { ... }
}
```

All four are mandatory. A case without ground truth cannot be scored automatically and is unusable for the research.

---

## 2. Hard Constraints

These are non-negotiable. A case that violates any of them must be regenerated.

| Constraint | Value |
|---|---|
| Suspects per case | 4 or 5 |
| Evidence items per case | 20 to 30 |
| Exactly one culprit | Yes — one suspect is responsible |
| Multi-hop reasoning required | At least 3 separate evidence items must be combined to prove guilt |
| Contradictions present | At least 2 contradictory pairs between testimony and physical evidence |
| Misleading evidence present | At least 3 evidence items must point at an innocent suspect |
| Irrelevant noise present | At least 4 evidence items must be unrelated to the solution |
| Ground truth answerable from evidence alone | Every claim in the ground truth must be supported by the included evidence |

---

## 3. Case Section

```json
"case": {
  "title": "<3-8 word evocative title>",
  "description": "<2-4 sentences setting the scene without revealing the solution>"
}
```

**Rules:**
- Title must not name the culprit
- Description must not hint which suspect is guilty
- Description must mention: where it happened, what happened, and that the investigator must figure out who is responsible

**Example:**
```json
"case": {
  "title": "The Harborside Gallery Theft",
  "description": "A priceless sculpture disappeared overnight from a private gallery during a closed-door reception. Four staff members had access to the building after hours. Determine who took the sculpture and how."
}
```

---

## 4. Suspects Section

```json
"suspects": [
  {
    "name": "<Full name>",
    "profile": "<1-3 sentences: role, relationship to victim/scene, motive or apparent lack thereof>"
  }
]
```

**Rules:**
- 4 or 5 entries
- Each suspect must have a *plausible* motive or *plausible* alibi (or both)
- The guilty suspect must not be the obviously suspicious one — the easy guess should be wrong
- At least one suspect should appear innocent at first read but have a hidden motive surfaced only by evidence correlation
- At least one suspect should appear suspicious but be exonerable by the evidence

---

## 5. Evidence Section

```json
"evidence": [
  {
    "type": "<one of the allowed types>",
    "category": "<one of the allowed categories>",
    "difficulty_weight": <number between 0.1 and 1.0>,
    "content": "<the evidence text itself>"
  }
]
```

### 5.1 Allowed `type` values

| Type | Meaning |
|---|---|
| `witness_statement` | Direct quote or paraphrase of what a person said |
| `forensic_report` | Physical / lab evidence (fingerprints, DNA, ballistics, chemistry) |
| `cctv_log` | Time-stamped camera observation |
| `financial_record` | Transactions, transfers, payments, account activity |
| `email_message` | Written communications (email, SMS, chat) |
| `location_report` | Badge scans, GPS, phone tower pings, sign-in logs |

### 5.2 Allowed `category` values

| Category | Use for |
|---|---|
| `alibi` | Evidence that establishes or breaks a suspect's whereabouts |
| `forensic` | Physical evidence linking a person to a scene or object |
| `communication` | Messages revealing intent, conflict, or knowledge |
| `financial` | Money movements revealing motive or means |
| `motive` | Evidence of grievance, gain, relationship, or pressure |
| `location` | Movement patterns and presence records |
| `contradiction` | An evidence item that directly contradicts another |

`type` describes the *form*. `category` describes the *investigative role*. Both are required.

### 5.3 `difficulty_weight` scale

| Range | Meaning |
|---|---|
| 0.8 – 1.0 | Critical — the case cannot be solved without this item |
| 0.4 – 0.7 | Supporting — useful but redundant with another item |
| 0.1 – 0.3 | Noise — irrelevant or misleading |

The critical items (weight ≥ 0.8) collectively must form the multi-hop chain that proves the culprit.

### 5.4 Content writing rules

Every evidence `content` string must:

- Include a **specific time** when temporally relevant (`5:15 PM`, `Tuesday morning`, `the night of the 14th`)
- Name **specific people** by their full name as listed in suspects, or by clearly identifiable role (`the night guard`)
- Be **self-contained** — readable without context from other evidence
- Be **concise** — one short paragraph maximum
- For witness statements, **quote the speaker directly** using single quotes inside the string
- For forensic and financial evidence, state the **finding** and the **person or object** it relates to

### 5.5 Composition rules across the evidence set

Within the 20–30 evidence items you must include all of the following:

- **Timeline coverage:** at least 6 items with timestamps spanning the relevant window
- **Cross-references:** at least 4 pairs of items that reference each other (one corroborates or contradicts another)
- **Hidden link:** at least one financial or communication item that reveals a relationship not mentioned in any suspect profile
- **Diversity of types:** at least 4 of the 6 `type` values must appear
- **Diversity of categories:** at least 5 of the 7 `category` values must appear

---

## 6. Ground Truth Section

```json
"ground_truth": {
  "correct_suspect_name": "<exact name from suspects[]>",
  "contradiction_pairs": [
    {
      "claim_evidence_index": <number>,
      "contradicting_evidence_index": <number>,
      "explanation": "<one sentence>"
    }
  ],
  "relevant_evidence_indices": [<numbers>],
  "optimal_next_actions": [
    {
      "action_type": "<one of allowed actions>",
      "target": "<suspect name or short evidence identifier>",
      "reason": "<one sentence>"
    }
  ]
}
```

### 6.1 `correct_suspect_name`

Must match exactly one entry in `suspects[].name`.

### 6.2 `contradiction_pairs`

- At least 2 entries
- `claim_evidence_index` and `contradicting_evidence_index` refer to positions in the `evidence[]` array (zero-based)
- Each `explanation` states *why* the two items contradict each other in one sentence

### 6.3 `relevant_evidence_indices`

The list of zero-based indices into `evidence[]` that an ideal investigator would cite when proving the case. This list must:

- Include every item with `difficulty_weight ≥ 0.8`
- Form a logical chain that, when read together, proves the culprit
- Contain between 3 and 8 items (the multi-hop chain length)

### 6.4 `optimal_next_actions`

The structured recommendations an ideal AI assistant would produce at the *decisive* moment in the investigation (when the player has enough evidence to act).

`action_type` must be one of:

| Action | Use when |
|---|---|
| `INTERROGATE` | The next correct step is to question a specific suspect |
| `EXAMINE_EVIDENCE` | The next correct step is to revisit or cross-check a specific piece of evidence |
| `REVIEW_TIMELINE` | The next correct step is to lay out a chronology |
| `INVESTIGATE_LOCATION` | The next correct step is to focus on a specific place |
| `SUBMIT_DEDUCTION` | Enough evidence exists to name the culprit |

Provide **2 to 4** optimal actions. They represent acceptable correct answers — the AI under test will match any of them to be scored correct.

---

## 7. Quality Self-Check

Before returning the case, verify each of these. If any fails, regenerate the affected section:

1. Can you write a 5-sentence proof of guilt that cites only items in `relevant_evidence_indices`? If not, the chain is broken.
2. Could a careful reader be misled to suspect a different suspect based on the misleading evidence? If not, the case is too easy.
3. Are at least two evidence items genuinely irrelevant to the solution? If not, retrieval has nothing to filter against.
4. Does the culprit's guilt depend on combining at least three separate evidence items (not just one smoking gun)? If not, the case is not multi-hop.
5. Do any two evidence items contradict each other in a way the AI is expected to detect? If not, contradiction-resolution cannot be measured.
6. Is every claim in the ground truth backed by evidence the player can actually see? If not, the answer key is unreachable.

---

## 8. Style Guidance

- Keep names culturally varied
- Avoid clichés (`the butler did it`, `evil twin`, `secret identical brother`)
- Crimes should be plausible white-collar, theft, fraud, assault, or unattended-death scenarios — avoid graphic violence
- Avoid real people, real companies, and real locations
- Keep tone professional and procedural — this is a reasoning exercise, not pulp fiction

---

## 9. Complete Minimal Example Skeleton

```json
{
  "case": {
    "title": "...",
    "description": "..."
  },
  "suspects": [
    { "name": "...", "profile": "..." }
  ],
  "evidence": [
    {
      "type": "witness_statement",
      "category": "alibi",
      "difficulty_weight": 0.9,
      "content": "..."
    }
  ],
  "ground_truth": {
    "correct_suspect_name": "...",
    "contradiction_pairs": [
      {
        "claim_evidence_index": 2,
        "contradicting_evidence_index": 7,
        "explanation": "..."
      }
    ],
    "relevant_evidence_indices": [0, 3, 7, 12],
    "optimal_next_actions": [
      {
        "action_type": "INTERROGATE",
        "target": "...",
        "reason": "..."
      }
    ]
  }
}
```

---

## 10. Output Format

Return **only** the JSON object. No surrounding prose, no markdown fencing, no commentary. The output must be directly parseable by `JSON.parse`.

The system will reject any output that:

- Contains text outside the JSON object
- Uses trailing commas
- Uses single-quoted JSON keys
- Includes JavaScript comments inside the JSON

---

## 11. Target Case Set

The research requires **3 cases total**. When generating a set:

- Case 1: medium difficulty — mostly two-document correlations
- Case 2: hard difficulty — multi-hop chains of 4+ items, two strong red herrings
- Case 3: hard difficulty — heavy contradiction load, the obvious suspect must be cleanly exonerable by the evidence

Vary the crime type, setting, and victim profile across the three cases.
