You are reviewing the source code of this research project to help write Chapter III (Metode Penelitian) of an undergraduate thesis.

Do NOT explain theoretical concepts such as Retrieval-Augmented Generation (RAG), Dense Retrieval, Sparse Retrieval, or Hybrid Retrieval. Those are already covered in Chapter II.

Your objective is to reverse engineer the implementation and produce technical documentation describing how this project is actually implemented.

Analyze the entire codebase and produce a structured report with the following sections.

1. Overall System Architecture

Describe the overall architecture of the system.

Include:

Frontend framework
Backend/API architecture
Database
Vector database implementation
LLM provider
Embedding model
Retrieval pipeline
Evaluation pipeline

Explain how data flows from the player's question until the final AI response.

2. Technology Stack

List every important technology actually used in the implementation.

Example:

Next.js version
TypeScript
Prisma
PostgreSQL version
pgvector
OpenAI SDK
Embedding model
Chat model
Tailwind
Docker (if used)

Only include technologies that are actually implemented.

3. Knowledge Base Design

Describe:

database schema
important tables
relationship between tables

Especially identify tables related to

cases
suspects
evidence
sessions
AI interaction logs
evaluation logs
ground truth (if exists)

For each table explain its role in the system.

4. Knowledge Base Preparation

Explain:

how documents are created
how evidence is stored
whether chunking is used
chunk size
overlap
metadata stored
preprocessing pipeline

If chunking is not implemented, explicitly state that.

5. Embedding Pipeline

Identify:

embedding model
embedding dimensions
where embeddings are generated
where they are stored
when embeddings are updated

Explain the complete embedding workflow.

6. Sparse Retrieval Implementation

Explain ONLY implementation details.

Include:

PostgreSQL Full Text Search configuration
tsvector
tsquery
ranking function
top-k retrieval
language configuration
important SQL queries
7. Dense Retrieval Implementation

Explain ONLY implementation details.

Include:

pgvector
similarity metric
HNSW configuration
index parameters
top-k retrieval
vector search query
8. Hybrid Retrieval Implementation

Explain:

how sparse and dense results are merged
RRF implementation
RRF constant (k)
weighting (if any)
reranking (if any)

If default RRF is used, explicitly state it.

9. Prompt Construction

Explain:

system prompt
user prompt
retrieved context injection
evidence formatting
prompt template

Show the prompt template if possible.

10. LLM Response Generation

Describe:

chat model
temperature
max tokens
streaming/non-streaming
response generation flow
11. Evaluation Pipeline

Explain how evaluation is implemented.

Include:

Retrieval metrics
RAGAS metrics
latency measurement
evaluation scripts
generated outputs
storage of evaluation results
12. Dataset Structure

Identify:

number of investigation cases
number of suspects
number of evidence
number of questions
ground truth location
evaluation dataset format
13. Experimental Variables

Identify:

Independent Variable

What changes between experiments?

Dependent Variables

What metrics are measured?

Controlled Variables

What remains constant across experiments?

14. System Workflow

Generate a step-by-step workflow describing exactly what happens when a player asks a question.

Example:

Player Question

↓

Retriever

↓

Retrieved Documents

↓

Prompt Builder

↓

LLM

↓

Response

↓

Evaluation

15. Architecture Diagrams

Based on the implementation, generate Mermaid diagrams for:

Overall Architecture
Retrieval Pipeline
Database ER Overview
Evaluation Pipeline
16. Configuration Summary

Produce a concise table containing every implementation parameter.

Example:

Component	Value
Embedding Model	
Chat Model	
Chunk Size	
Chunk Overlap	
Top K	
Vector Similarity	
HNSW M	
ef_search	
RRF k	
Temperature	
Database	
ORM	

If a value cannot be found in the source code, explicitly write "Not Found" instead of guessing.

Important Instructions
Do not explain theory.
Do not summarize academic papers.
Only describe what is actually implemented.
Whenever possible, include the file path where the implementation is found.
If there are inconsistencies between the code and the documentation, prioritize the source code and report the inconsistency.
Never infer missing values. Report "Not Found" if the implementation does not specify them.