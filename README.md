# Investigation System - RAG-Based LLM Decision Support

Interactive investigation simulation system for evaluating how Retrieval-Augmented Generation (RAG) improves contextual decision-making in LLM-assisted investigative gameplay.

## Project Structure

```
.
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── cases/         # Case management endpoints
│   │   ├── sessions/      # Session management
│   │   └── ai/            # AI interaction endpoints
│   ├── page.tsx           # Main entry point
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── CaseSelection.tsx  # Case selection UI
│   └── InvestigationDashboard.tsx # Main investigation interface
├── lib/                   # Utility functions
│   ├── db.ts             # Prisma client
│   ├── embedding.ts      # OpenAI embedding generation
│   ├── rag.ts            # RAG retrieval logic
│   └── case-data.ts      # Case data format specification
├── prisma/               # Database schema and migrations
│   ├── schema.prisma     # Database schema
│   └── seed.ts          # Database seed script
└── README.md
```

## Setup Instructions

### 1. Environment Setup

Create `.env.local` with required variables:

```env
DATABASE_URL="postgresql://admin:root@localhost:5432/thesis?schema=public"
OPENAI_API_KEY="your-openai-api-key"
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Generate Prisma Client

```bash
npm run prisma:generate
```

### 4. Create Database Schema

```bash
npm run prisma:migrate
```

### 5. Seed Database with Cases

```bash
npm run seed
```

This loads 3 sample investigation cases with suspects and evidence.

### 6. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Database Schema

### Core Tables

- **cases**: Investigation cases
  - id, title, description, createdAt, updatedAt

- **suspects**: Case suspects
  - id, caseId, name, profile

- **evidence**: Investigation evidence with vector embeddings
  - id, caseId, type, content, embedding

### Investigation Tracking

- **investigation_sessions**: Player sessions with RAG toggle
  - id, caseId, ragEnabled, createdAt, updatedAt

- **investigation_logs**: Player actions during investigation
  - id, sessionId, action, target, createdAt

- **ai_interaction_logs**: AI responses with metrics
  - All prompt/response content
  - Timing metrics (retrieval_time_ms, llm_response_time_ms, total_response_time_ms)
  - Token usage (prompt_tokens, completion_tokens, total_tokens)
  - Hallucination detection flags
  - Correctness scoring fields

## Creating Custom Cases

Use the standardized case data format in `lib/case-data.ts`.

Example JSON structure for AI case generation:

```json
{
  "case": {
    "title": "Case Title",
    "description": "2-3 sentence description"
  },
  "suspects": [
    {
      "name": "Suspect Name",
      "profile": "Background and motive"
    }
  ],
  "evidence": [
    {
      "type": "witness_statement|forensic_report|cctv_log|financial_record|email_message|location_report",
      "content": "Specific evidence details"
    }
  ]
}
```

To add custom cases:
1. Generate case JSON using `lib/case-data.ts` format
2. Add to `sampleCases` array in `prisma/seed.ts`
3. Run `npm run seed`

## API Endpoints

### Cases
- `GET /api/cases` - List all cases
- `GET /api/cases/[id]` - Get case details with suspects and evidence

### Sessions
- `POST /api/sessions` - Create investigation session
  - Body: `{ caseId: string, ragEnabled: boolean }`

### AI Interaction
- `POST /api/ai/interact` - Get AI response
  - Body: `{ sessionId, caseId, prompt, ragEnabled }`
  - Response includes: response text, timings, token usage, log ID

## Features

### Investigation Interface
- Case selection with RAG mode toggle
- Evidence inspection sidebar
- Suspect profile viewing
- Predefined investigation prompts
- Custom free-text prompts
- Real-time AI responses

### RAG System
- Vector embedding of all evidence using OpenAI embeddings
- Semantic similarity search via pgvector
- Injection of relevant evidence into LLM context
- Investigation history retrieval

### Evaluation Metrics
- **Response Timings**: retrieval_time_ms, llm_response_time_ms, total_response_time_ms
- **Token Usage**: prompt_tokens, completion_tokens, total_tokens
- **Hallucination Detection**: boolean flag + reason field
- **Correctness Scoring**: optional 0-1 score field
- **Auto Logging**: all metrics captured per interaction

## Development

### Prisma Studio
```bash
npm run prisma:studio
```

Access database GUI at `http://localhost:5555`

### Build for Production
```bash
npm run build
npm start
```

## Technology Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with pgvector
- **ORM**: Prisma
- **LLM**: OpenAI API (GPT-4 Turbo)
- **Embeddings**: OpenAI text-embedding-3-small

## Research Contribution

This system enables evaluation of RAG's impact on:
1. Decision accuracy in LLM recommendations
2. Hallucination reduction with grounded context
3. Contextual consistency through evidence retrieval
4. Investigation workflow efficiency

The RAG toggle allows A/B comparison between standard LLM and retrieval-augmented approaches using identical case data and investigation scenarios.
