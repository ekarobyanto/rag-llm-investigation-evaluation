# Experimental Case and Scenario Design

This document details the design of the primary investigation case and the evaluation scenarios used to test the LLM's reasoning and retrieval capabilities under different RAG configurations.

## The Case: "The Nexus Data Breach"

To ensure a robust evaluation of Sparse, Dense, and Hybrid retrieval methods, the experimental design utilizes a single, large-scale synthetic investigation case. This approach provides a sufficient volume of evidence (150 items) to make the retrieval task challenging, directly addressing the limitations of smaller, context-window-fitting datasets.

### Case Summary
On January 15, 2027, cybersecurity firm Nexus Dynamics discovered that their proprietary threat intelligence database was exfiltrated via an internal service account (`svc-threatfeed`) VPN tunnel between 02:00 and 05:00. Approximately 2.3 terabytes of data appeared on a dark web marketplace 72 hours later. The objective of the LLM investigator is to analyze the evidence and identify the culprit among five internal suspects.

### Suspect Profiles
The case is designed with five suspects, each serving a specific narrative purpose to test the LLM's deductive reasoning and ability to filter out red herrings:

1. **Marcus Chen (Senior Security Engineer)** - **The Culprit**. Has both the technical capability and a financial motive. His evidence trail contains deep forensic clues and contradictions regarding his whereabouts.
2. **Dr. Sarah Okonkwo (Chief Technology Officer)** - **Strong Red Herring**. Has root-level access and a motive (budget disputes), and was in the office late during the night of the breach. However, digital forensics exonerate her.
3. **Viktor Petrov (DevOps Engineer)** - **Suspicious Red Herring**. Manages the service accounts and lied about his departure time from the office. However, he has a solid alibi (at a bar) during the actual breach window.
4. **James Whitfield (VP of Sales)** - **Motive but No Skills**. Extremely angry about a lost contract and in contact with a competitor, providing a strong motive. However, he completely lacks the technical skills or access required to execute the breach.
5. **Aisha Rahman (Data Analyst)** - **Clearly Innocent**. Has read-only access and an ironclad alibi (on a commercial flight during the breach window).

### Evidence Corpus (150 Items)
The corpus consists of exactly 150 evidence items, distributed evenly (~30 items per suspect). This size ensures that poor retrieval strategies will fail to surface the necessary clues. 

The evidence is categorized into various types to test multi-hop reasoning:
- **Location & Alibi**: CCTV logs, badge scans, Uber receipts, smart home telemetry.
- **Forensic**: Network logs, VPN connections, laptop audits, service account histories.
- **Communication**: Emails, Signal messages, Slack logs.
- **Financial**: Bank statements, crypto transactions, personal debts.
- **Noise**: Routine daily activities (Netflix, food delivery, gym visits) designed to act as distractors during retrieval.

### Programmed Contradictions
To evaluate the LLM's ability to detect deception, the ground truth contains specific programmed contradictions:
1. **Marcus Chen's Alibi**: Marcus claims to have been asleep with his laptop off, but smart home telemetry shows his office was occupied with the desk lamp active until 05:30.
2. **Marcus Chen's Technical Denial**: Marcus claims he didn't access company systems, but ISP metadata proves a sustained 142 Mbps upload from his home IP during the breach.
3. **Viktor Petrov's Lie**: Viktor claims he left the office at 17:00, but CCTV and badge logs prove he left at 19:15 to go to a bar.

---

## Evaluation Scenarios (30 Tests)

To systematically evaluate the RAG pipeline, 30 distinct scenarios were created. These scenarios vary in complexity and target different suspects, requiring the LLM to pull specific combinations of evidence.

The scenarios are stratified into three difficulty tiers:

### 1. Easy Scenarios (10 Tests)
- **Objective**: Test basic single-hop retrieval and direct fact-extraction.
- **Characteristics**: Requires pulling 1-4 highly specific evidence items that directly answer a straightforward question.
- **Examples**:
  - *"What flight was Aisha Rahman on during the breach?"*
  - *"Does James Whitfield have the technical capability to execute this breach?"*

### 2. Medium Scenarios (12 Tests)
- **Objective**: Test multi-hop retrieval and comparative analysis.
- **Characteristics**: Requires synthesizing 7-10 pieces of evidence across different categories (e.g., comparing financial motives, or cross-referencing a suspect's claims with their digital footprint).
- **Examples**:
  - *"Evaluate Marcus Chen's alibi for the night of the breach."* (Requires finding the contradiction).
  - *"Compare the financial profiles of all five suspects for suspicious activity."*

### 3. Hard Scenarios (8 Tests)
- **Objective**: Test complex deduction, timeline reconstruction, and holistic case synthesis.
- **Characteristics**: Requires retrieving 10-18 pieces of evidence, identifying hidden connections, filtering out strong red herrings, and formulating a definitive conclusion.
- **Examples**:
  - *"Trace the complete exfiltration chain from preparation through payment."*
  - *"Cross-reference digital forensics with physical evidence to identify the breach perpetrator."*
  - *"Submit your final deduction: who is the data thief and what is the complete reasoning?"*

### Scenario Ground Truth
Every scenario includes:
- **`requiredEvidenceIndices`**: The exact evidence IDs the retriever *should* fetch. This is used to calculate **Retrieval Precision** and **Retrieval Recall**.
- **`referenceAnswer`**: A human-authored ideal response. This is used by the RAGAS framework to evaluate the LLM's final response for **Answer Relevance**, **Faithfulness**, and **Context Accuracy**.
- **`expectedActions`**: The ideal investigator actions the LLM should recommend based on the scenario context.
