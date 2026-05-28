# Quick Setup Guide

## Prerequisites
- PostgreSQL running in Docker (checked: running)
- Node.js 18+
- OpenAI API key

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Configure Environment
Edit `.env.local` and add your OpenAI API key:
```env
OPENAI_API_KEY="sk-..."
```

## Step 3: Setup Database
```bash
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

## Step 4: Start Development Server
```bash
npm run dev
```

Open `http://localhost:3000` in browser.

## Testing the System

1. **Case Selection**
   - Page loads with 3 seed cases
   - Select a case
   - Choose RAG mode (Enabled = uses retrieval, Disabled = plain LLM)
   - Click "Start Investigation"

2. **Investigation Dashboard**
   - Left sidebar: Browse evidence and suspects
   - Center panel: View investigation notes and AI responses
   - Right panel: Send predefined prompts or custom questions
   - Toggle between RAG modes by restarting investigation

3. **Verify Metrics Logging**
   ```bash
   npm run prisma:studio
   ```
   Opens `http://localhost:5555` to view:
   - investigation_sessions (with ragEnabled flag)
   - ai_interaction_logs (with full metrics)

## Adding Custom Cases

1. Generate case JSON using format in `lib/case-data.ts`
2. Add to `sampleCases` in `prisma/seed.ts`
3. Run `npm run seed` (clears and reloads database)

Example case JSON format:
```json
{
  "case": {
    "title": "Case Title",
    "description": "Description"
  },
  "suspects": [
    {"name": "Name", "profile": "Background"}
  ],
  "evidence": [
    {
      "type": "witness_statement",
      "content": "Statement text"
    }
  ]
}
```

## Database Connection Details
- Host: localhost:5432
- User: admin
- Password: root
- Database: thesis

## Next Steps

1. **Test RAG Functionality**
   - Run investigations with RAG ON vs OFF
   - Monitor response times in logs
   - Check retrieved context in ai_interaction_logs table

2. **Add Case Data**
   - Generate 3 well-designed detective cases
   - Use case data format from `lib/case-data.ts`
   - Seed database with `npm run seed`

3. **Customize Case Design**
   - Modify suspect profiles for complexity
   - Adjust evidence types for domain relevance
   - Add timeline conflicts and contradictions

4. **Evaluate Results**
   - Query ai_interaction_logs for metrics
   - Compare RAG vs non-RAG performance
   - Analyze hallucination detection

## Troubleshooting

**Database Connection Error**
- Ensure PostgreSQL container is running: `docker ps`
- Check DATABASE_URL in .env.local

**OpenAI API Error**
- Verify OPENAI_API_KEY is set
- Check API key has proper permissions
- Verify rate limits not exceeded

**Embedding Generation Fails**
- Seed script will create evidence without embeddings if API fails
- Vector search will fall back gracefully
- Check OpenAI API quota/balance

**Port Already in Use**
- Change port: `npm run dev -- -p 3001`
- Or kill process: `lsof -i :3000`
