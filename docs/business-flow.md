# Business Flow Documentation

**Investigation Decision Support System**

---

## 1. Purpose

A controlled simulation where a player acts as a criminal investigator and is assisted by an AI investigation advisor. The system exists to study whether AI assistance becomes more reliable when grounded in case evidence retrieved on-demand, versus an AI operating from general knowledge alone.

The player is the decision-maker. The AI is a reasoning support tool — never the autonomous solver of the case.

---

## 2. Stakeholders

| Stakeholder | Role |
|---|---|
| Player | The investigator. Drives the case, makes deductions, submits conclusions. |
| AI Assistant | Provides analysis, contradictions, and structured recommendations on request. |
| Researcher | Reviews logged sessions to evaluate AI quality across modes. |
| Case Designer | Authors cases, suspects, evidence, and ground truth answers. |

---

## 3. End-to-End User Journey

### Stage 1 — Entry

The player opens the application and is presented with a list of available investigation cases. Each case shows a short title and description, giving enough context to choose without revealing the solution.

### Stage 2 — Mode Selection

Before entering a case, the player selects an investigation mode:

- **Standard Mode** — AI responds from general knowledge only
- **Assisted Mode** — AI responds with access to case evidence and prior conversation

The mode is locked once the session begins. This separation is the foundation of the research comparison.

### Stage 3 — Investigation Dashboard

The player enters the investigation workspace. The workspace shows:

- The case briefing
- A roster of suspects with short profiles
- A library of evidence documents (reports, witness statements, communications, financial records, location data, etc.)
- A conversation panel with the AI assistant

The player is free to explore in any order.

### Stage 4 — Active Investigation

The player works the case through repeated cycles of:

1. **Inspect** — read evidence, review a suspect profile, study a timeline
2. **Consult** — ask the AI for analysis, summaries, contradictions, or next-step recommendations
3. **Reason** — interpret the AI's reply, decide what to investigate next
4. **Act** — open more evidence, narrow suspicions, form a hypothesis

The AI always returns two things together:
- A human-readable explanation
- A structured recommendation (a specific action with a target and a reason)

The structured recommendation gives the player a concrete next step they can accept, modify, or ignore.

### Stage 5 — Deduction

When the player believes they have enough evidence, they submit a final deduction naming the suspect they believe is responsible and citing the supporting evidence. This closes the active investigation phase of the session.

### Stage 6 — Session End

The session is preserved with its full interaction history for later analysis by the researcher.

---

## 4. AI Interaction Flow

Every player question to the AI follows the same business steps:

1. The player asks something (free text or via a guided prompt button)
2. The system checks the active mode
3. **If Assisted Mode:** the system silently looks up the most relevant evidence and recent conversation turns to ground the AI's answer
4. **If Standard Mode:** the AI receives only the player's question
5. The AI produces an explanation plus a structured recommendation
6. The player sees the response and decides what to do next
7. The interaction is logged with all evaluation data for the researcher

The player never sees the retrieval step — it happens invisibly. From the player's perspective the AI simply seems more or less informed depending on the mode.

---

## 5. Guided Prompt Catalog

To keep investigations consistent and to remove prompt-writing skill as a variable in the research, the AI panel offers a small set of standard prompt buttons:

- Summarize the evidence so far
- Identify contradictions
- Suggest the next investigation step
- Explain a timeline conflict
- Surface the most relevant evidence

Players may still type free-form questions, but the buttons cover the core investigative needs.

---

## 6. Case Design Principles

Each case is hand-crafted to meet research requirements:

- **3 investigation cases** total
- **4–5 suspects** per case
- **20–30 evidence documents** per case
- **Hidden contradictions** that only surface when documents are correlated
- **Misleading evidence** that points at innocent suspects
- **Irrelevant evidence** that adds noise
- **Multi-hop reasoning** — the solution requires combining at least three separate documents

Evidence is tagged with:
- A **category** (alibi, forensic, communication, financial, motive, location, contradiction)
- A **difficulty weight** describing how critical it is to the solution

Cases are deliberately too large to fit entirely into a single AI request — this forces the Assisted Mode to behave selectively rather than dumping everything at once.

---

## 7. Ground Truth System

Every case has an authored solution stored separately from gameplay data. The solution defines:

- The actual culprit
- The chains of evidence that prove the case
- The known contradictions and which documents reveal them
- The optimal investigation actions an ideal investigator would take

This is the answer key. It is never shown to the player and is never given to the AI. Its sole purpose is to let the researcher score the AI's recommendations automatically and objectively.

---

## 8. Research Evaluation Flow

The research value of the system comes from what happens *after* gameplay.

For each AI interaction the researcher can examine:

| Question | What it measures |
|---|---|
| Did the AI recommend an action the case solution endorses? | Recommendation accuracy |
| Did the AI surface a contradiction the case actually contains? | Contradiction resolution |
| Did the AI invent facts not present in the evidence? | Hallucination rate |
| In Assisted Mode, did retrieval pull in the right evidence? | Retrieval precision and recall |
| How long did the AI take to respond? | Practical usability |
| How much did the interaction cost in tokens? | Operational feasibility |

By comparing Standard Mode and Assisted Mode sessions on identical cases, the researcher can answer the central question: *does grounding the AI in retrieved evidence make it a better investigation partner?*

---

## 9. Expected Behavioral Differences

The cases are designed so the two modes diverge predictably:

| Reasoning Difficulty | Standard Mode | Assisted Mode |
|---|---|---|
| Easy (single evidence) | Comparable | Comparable |
| Medium (two-evidence correlation) | Moderate degradation | Noticeably better |
| Hard (multi-hop contradiction) | Significant degradation | Strong improvement |

If the data confirms this pattern, the research supports the thesis that retrieval grounding is valuable specifically when reasoning depth increases.

---

## 10. Scope Boundaries

The system intentionally does **not** include:

- Player accounts or authentication
- Multiplayer or collaborative investigation
- Real-time events or time pressure
- Open-world or free-roaming gameplay
- Voice input or speech output
- Procedurally generated cases
- An AI that solves the case autonomously

These exclusions keep the experiment controlled, reproducible, and focused on the research question.

---

## 11. Session Lifecycle Summary

```
Choose case
   ↓
Choose mode (Standard or Assisted)
   ↓
Enter investigation dashboard
   ↓
Loop: Inspect → Consult AI → Reason → Act
   ↓
Submit final deduction
   ↓
Session archived for evaluation
```

---

## 12. Success Criteria

The project succeeds when:

- A player can complete an investigation end-to-end in either mode without friction
- Every AI interaction produces both a human explanation and a structured recommendation
- Every interaction is logged with the data needed to score it against the case solution
- The researcher can compare Standard vs Assisted sessions on identical cases and draw conclusions about retrieval-grounded AI assistance
