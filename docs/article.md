# Thesis Article Points

Draft bullet points for thesis chapters. Each section lists claims, framings, and supporting evidence you can expand into prose. Cite numbers from your evaluation runs once available.

---

## 1. Background and Motivation

- Large Language Models (LLMs) demonstrate strong reasoning across general domains but underperform when reasoning depends on *specific, non-public, or evolving* information not present in their pretraining corpus.
- Investigative reasoning — combining evidence, identifying contradictions, recommending next actions — is a high-stakes domain where hallucinated facts can lead to wrong conclusions and lost credibility.
- Retrieval-Augmented Generation (RAG) addresses this gap by grounding LLM responses in retrieved domain documents at inference time, but its effectiveness on multi-hop reasoning tasks remains contested in the literature.
- This thesis investigates whether RAG meaningfully improves an LLM's role as a *decision-support assistant* — not as an autonomous solver — in a controlled investigation simulation environment.
- Distinguishing assistant-style support from autonomous agency is itself a contribution: most prior work studies RAG for question answering or summarization, not for structured investigative decision-making with measurable correctness criteria.

---

## 2. Problem Statement

- An LLM operating without retrieval can confidently produce plausible but unsupported investigative recommendations (hallucination).
- An LLM with naive retrieval (dumping all available context) suffers from token cost explosion and reasoning dilution.
- A *selective* RAG approach — retrieving only the most relevant evidence per query — is hypothesized to balance grounding and efficiency, but objective evaluation requires a controlled environment with known ground truth.
- Current evaluation practices in industry use ad-hoc prompts and subjective judgment. This thesis proposes a reproducible, ground-truth-anchored evaluation methodology.

---

## 3. Research Questions

- **RQ1** — Does selective RAG improve the *correctness* of structured investigative recommendations relative to plain LLM responses?
- **RQ2** — Does selective RAG *reduce hallucination* in investigative reasoning?
- **RQ3** — Does retrieval of investigation history (intra-session context) improve *contextual consistency* across multi-turn interactions?
- **RQ4** — What is the *cost* of selective RAG in terms of response time and token usage?
- **RQ5** (extension) — Does the RAG benefit scale with reasoning *difficulty*? Hypothesis: marginal benefit on easy cases, significant benefit on multi-hop cases.

---

## 4. Contributions

- A controlled, reproducible benchmark of three multi-hop criminal-investigation cases with authored ground truth, evidence dependency chains, and difficulty grading.
- An automated evaluation pipeline that scores LLM recommendations against ground truth without human judgment for the primary metrics.
- An empirical comparison of RAG-enabled and RAG-disabled LLM assistants across structured-recommendation accuracy, retrieval quality, response latency, and operational cost.
- An open architecture (Next.js + PostgreSQL + pgvector + Prisma) demonstrating that production-grade RAG can be implemented with widely available open tooling.
- A finding (to be confirmed) that selective RAG's benefit is *non-uniform* across reasoning difficulty — supporting the position that retrieval grounding is most valuable precisely when reasoning depth exceeds parametric knowledge reach.

---

## 5. Related Work — Hooks

- Lewis et al. (2020) introduced RAG; their evaluation focused on open-domain QA, not investigative reasoning.
- Subsequent work on RAG variants (FiD, REPLUG, Self-RAG) primarily evaluated on benchmarks such as Natural Questions and TriviaQA — single-hop factoid retrieval.
- Multi-hop QA benchmarks (HotpotQA, MuSiQue) test reasoning chains but lack the *adversarial misleading evidence* characteristic of investigation domains.
- Hallucination evaluation in LLMs remains an open problem; LLM-as-judge approaches (e.g., G-Eval) trade rigor for scalability.
- Investigation-domain LLM applications exist in commercial settings (e.g., legal discovery, threat intelligence) but lack public reproducible benchmarks.
- Position this thesis as occupying the intersection: structured decision support + multi-hop adversarial reasoning + reproducible automated evaluation.

---

## 6. System Design — Talking Points

- Framework choice (Next.js): single-stack TypeScript reduces context-switching overhead for thesis-scale implementation and makes the system reproducible for evaluators.
- Database choice (PostgreSQL + pgvector): mature relational storage with first-class vector similarity, avoiding lock-in to dedicated vector databases.
- Embedding model (`text-embedding-3-small`, 1536 dimensions): chosen for cost-quality tradeoff; alternatives (Ollama, Cohere) were evaluated but not used in primary experiments to maintain control of variables.
- LLM choice (`gpt-4o`): selected for cost (3-4× cheaper than gpt-4-turbo with comparable reasoning quality on investigation tasks based on preliminary tests).
- Schema separates immutable evidence (with embeddings) from dynamic investigation history (interaction logs) — preventing factual contamination of retrieval results.
- Ground truth stored in a separate table not visible to the model, enabling automatic scoring without leaking answers.
- Prompt template is versioned (`prompt_template_version` column) — every interaction log carries the template revision that produced it, supporting longitudinal experiment integrity.

---

## 7. Case Design — Methodology Justification

- Three cases generated using a controlled specification (see `docs/create-cases.md`) ensuring uniform structure.
- Each case authored to contain 4–5 suspects, 20–30 evidence documents, ≥2 contradictions, ≥3 misleading items, ≥4 noise items.
- Evidence tagged with category (`alibi`, `forensic`, `communication`, `financial`, `motive`, `location`, `contradiction`) and `difficulty_weight` (0.1–1.0), enabling per-category and per-weight analysis.
- Cases are *intentionally too large* to fit comfortably in a single direct-context LLM prompt — forcing selective retrieval behavior to be measured against full-context as upper bound.
- Difficulty stratification: Case 1 (medium), Case 2 (hard), Case 3 (hard+) — supporting RQ5 analysis of difficulty × RAG interaction.
- Cases avoid graphic content and real-world identifiers — ethical and reproducibility consideration.

---

## 8. Evaluation Methodology

- **Standardized scenarios** rather than free-form interaction: each scenario is a fixed prompt with authored expected actions and required evidence, enabling repeated measurement.
- **Identical scenarios** evaluated under both RAG ON and RAG OFF conditions — paired-sample design controls for case-level confounds.
- **Temperature fixed at 0.2** — reduces sampling variance; multiple runs (N=3 recommended) used to estimate residual variance.
- **Automatic scoring** via exact-match on structured recommendation (`action_type` + `target` vs authored optimal actions) — removes human subjectivity for the primary metric.
- **Retrieval metrics** (precision, recall, top-K accuracy) computed against authored `required_evidence` sets per scenario — not per case — enabling fine-grained retrieval analysis.
- **Cost and latency** logged automatically — supporting RQ4 with empirical numbers, not estimates.

---

## 9. Metrics — Definitions to Include

- **Recommendation Accuracy** — proportion of scenarios where the model's structured recommendation matches at least one authored optimal action by `action_type` AND `target`.
- **Retrieval Precision** — `|retrieved ∩ required| / |retrieved|` per scenario, averaged across runs.
- **Retrieval Recall** — `|retrieved ∩ required| / |required|` per scenario, averaged.
- **Top-K Accuracy** — boolean: at least one required evidence appears in top-K retrieved results.
- **Hallucination Rate** — proportion of responses containing claims unsupported by evidence (assessed via LLM-as-judge in Phase 2).
- **Contradiction Resolution Rate** — proportion of authored contradictions that the model correctly identifies and explains.
- **Response Time** — wall-clock end-to-end (retrieval + LLM) in milliseconds.
- **Token Usage** — prompt + completion tokens per OpenAI API report.
- **Operational Cost** — derived from token usage and current OpenAI pricing.

---

## 10. Hypotheses

- **H1** — Recommendation accuracy under RAG ON exceeds RAG OFF, with effect size growing as scenario difficulty increases.
- **H2** — Hallucination rate under RAG ON is lower than RAG OFF.
- **H3** — RAG ON incurs higher token usage and longer response time than RAG OFF, but the increase is sublinear in case size (selective retrieval limits growth).
- **H4** — Retrieval precision and recall are positively correlated with downstream recommendation accuracy — i.e., retrieval quality is causally relevant, not incidental.
- **H5** — On easy scenarios (single-evidence reasoning), RAG ON and RAG OFF perform comparably; the benefit of grounding emerges only when reasoning requires evidence the model could not infer.

---

## 11. Threats to Validity

- **Internal validity** — Authored ground truth may itself be biased toward retrieval-friendly evidence chains; mitigation: include scenarios where the easy answer is wrong and contradictions are required.
- **External validity** — Three cases is a small sample for cross-domain claims; thesis claims should be scoped to investigative-reasoning tasks, not generalized to all RAG applications.
- **Construct validity** — Exact-match scoring may under-credit partially correct recommendations; mitigation: include partial-credit variant in extended analysis.
- **Reliability** — Model nondeterminism even at temperature 0.2 introduces variance; mitigation: multiple runs per scenario, report standard deviation.
- **LLM provider drift** — OpenAI may update `gpt-4o` mid-experiment; mitigation: log full model identifier on every call, freeze experiment window.

---

## 12. Anticipated Results Discussion Points

- If H1 confirmed and H5 confirmed, the discussion can argue that RAG's value is *conditional on task structure*, not unconditional — a more nuanced position than "RAG always helps."
- If H2 confirmed, position the result as supporting the broader claim that *grounding reduces fabrication* — connect to safety implications.
- If H3 confirms higher cost, frame as a Pareto trade-off rather than a flaw — practitioners can pick the operating point given their accuracy requirements.
- If H4 fails (retrieval quality does *not* predict accuracy), discuss the possibility that prompt construction or LLM reasoning dominates, and that retrieval is only a precondition not a determinant.
- If H5 fails (RAG helps uniformly, including easy cases), reconsider whether the easy cases are truly easy or whether they retain subtle complexity.

---

## 13. Limitations to Explicitly Acknowledge

- Single LLM family (OpenAI) — cannot generalize to all LLMs.
- Single embedding model — retrieval quality is conditional on this choice.
- Cases are synthetic, not derived from real investigations — ecological validity is limited.
- No human user study — usability claims rely on response time, not subjective user experience.
- Hallucination detection (Phase 2) uses LLM-as-judge — judge bias is a known issue.
- Evaluation does not measure long-term session effects (player learning, fatigue).

---

## 14. Future Work

- Replicate experiments on locally hosted open-weight LLMs (Llama 3.1, Mistral) — generality test.
- Replace OpenAI embeddings with Ollama (`nomic-embed-text`) — cost and privacy test.
- Add a human-in-the-loop study comparing investigator satisfaction with and without RAG.
- Extend cases to additional domains (medical differential diagnosis, intelligence analysis, code root-cause investigation).
- Investigate dynamic retrieval — adjusting K based on query complexity rather than fixed K=5.
- Add evidence-dependency-chain reasoning support — explicit chains rather than implicit similarity.
- Evaluate against agentic LLMs that retrieve iteratively rather than once-per-turn.

---

## 15. Practical Implications

- For *practitioners* — selective RAG is implementable on commodity infrastructure (Postgres + pgvector + Next.js) without dedicated vector databases or ML expertise.
- For *researchers* — reproducible automated evaluation of LLM-based decision support is feasible when ground truth is authored alongside scenarios.
- For *system designers* — separation of immutable factual evidence from mutable interaction history is a useful architectural pattern, applicable beyond investigation domains.
- For *educators* — investigation-style simulations can serve as teaching tools where students reason against the AI rather than receive answers from it.

---

## 16. One-Sentence Summaries (for abstract / intro hooks)

- *Selective Retrieval-Augmented Generation improves the correctness of structured investigative recommendations relative to non-grounded LLM responses, with effect size proportional to reasoning depth.*
- *This thesis presents a reproducible automated benchmark for evaluating retrieval-augmented LLM decision support, demonstrating that retrieval grounding most benefits multi-hop adversarial reasoning tasks.*
- *We show that retrieval grounding reduces LLM hallucination in investigative reasoning without prohibitive cost, supporting RAG as a viable architecture for decision-support assistants.*

---

## 17. Numbers to Collect Before Writing

After running the evaluation pipeline, fill these in before drafting the Results chapter:

| Metric | RAG OFF | RAG ON | Δ |
|---|---|---|---|
| Recommendation accuracy (all) | ___ | ___ | ___ |
| Recommendation accuracy (easy) | ___ | ___ | ___ |
| Recommendation accuracy (medium) | ___ | ___ | ___ |
| Recommendation accuracy (hard) | ___ | ___ | ___ |
| Retrieval precision (RAG ON only) | — | ___ | — |
| Retrieval recall (RAG ON only) | — | ___ | — |
| Top-K accuracy rate | — | ___ | — |
| Hallucination rate | ___ | ___ | ___ |
| Avg total response time (ms) | ___ | ___ | ___ |
| Avg total tokens | ___ | ___ | ___ |
| Avg cost per interaction ($) | ___ | ___ | ___ |
| Contradiction resolution rate | ___ | ___ | ___ |
| Total experiment cost ($) | ___ | ___ | ___ |
