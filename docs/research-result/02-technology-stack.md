# 2. Technology Stack

Berikut daftar lengkap teknologi yang benar-benar digunakan dalam implementasi:

| Teknologi | Versi | Peran | Sumber |
|---|---|---|---|
| Next.js | ^15.0.0 | Full-stack framework (frontend + API routes) | `package.json` |
| React | ^19.0.0 | UI library | `package.json` |
| TypeScript | ^5.3.3 | Primary language | `package.json`, `tsconfig.json` |
| Prisma | ^5.11.0 | ORM / database client | `package.json` |
| PostgreSQL | latest (via Docker `ankane/pgvector`) | Relational database | `docker-compose.yml` |
| pgvector | 0.2.1 (npm) + PostgreSQL extension | Vector similarity search | `package.json`, `prisma/schema.prisma` |
| OpenAI SDK | ^4.52.7 | LLM & embedding API client | `package.json` |
| `gpt-4o` | — | Chat completion model | `lib/rag.ts` (line 163) |
| `text-embedding-3-small` | — | Embedding model (1536 dimensions) | `lib/embedding.ts` (line 9) |
| Tailwind CSS | ^3.4.1 | Utility-first CSS framework | `package.json`, `tailwind.config.ts` |
| Docker Compose | 3.8 | Container orchestration (PostgreSQL + pgAdmin) | `docker-compose.yml` |
| pgAdmin 4 | latest | Database management UI (optional) | `docker-compose.yml` |
| Python (eval pipeline) | — | RAGAS evaluation scripts | `eval-pipeline/` |
| RAGAS | 0.2.7 | LLM-based evaluation framework | `eval-pipeline/requirements.txt` |
| LangChain | 0.3.7 | RAGAS dependency (LLM wrappers) | `eval-pipeline/requirements.txt` |
| Pandas | 2.2.3 | Data manipulation for evaluation | `eval-pipeline/requirements.txt` |
| psycopg2 | 2.9.10 | PostgreSQL driver for Python | `eval-pipeline/requirements.txt` |
| tsx | ^4.22.3 | TypeScript execution (seeding scripts) | `package.json` |
| ESLint | ^8.56.0 | Code linting | `package.json` |
| PostCSS | ^8.4.32 | CSS processing | `package.json` |
| autoprefixer | ^10.4.16 | CSS vendor prefixes | `package.json` |

### Catatan
- **Docker** digunakan untuk menjalankan PostgreSQL dengan ekstensi pgvector dan pgAdmin. Aplikasi Next.js sendiri tidak di-containerize.
- **Python** hanya digunakan untuk pipeline RAGAS external, bukan untuk aplikasi utama.
- **`gpt-4o-mini`** digunakan sebagai LLM judge di RAGAS evaluation (`eval-pipeline/run_ragas.py` line 102), berbeda dari `gpt-4o` yang digunakan untuk chat completion utama.
