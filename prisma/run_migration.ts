import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { join } from "path"
import { config } from "dotenv"

// Load env vars from .env.local
config({ path: ".env.local" })

const prisma = new PrismaClient()

async function main() {
  const sql = readFileSync(
    join(__dirname, "migrations", "manual_sparse_dense_hybrid.sql"),
    "utf8"
  )
  
  console.log("Running manual migration...")
  
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  for (const stmt of statements) {
    if (stmt.includes("CREATE OR REPLACE FUNCTION") && !stmt.includes("$$ LANGUAGE plpgsql")) {
       // Since we are splitting by ;, it breaks the function block. Let's just execute the whole SQL at once if possible.
       // Or even better, let's just use raw query directly.
    }
  }
}

// Actually, let's just execute the raw SQL string without splitting. Prisma $executeRawUnsafe can handle multiple statements in Postgres.
async function runAll() {
  const sql = readFileSync(
    join(__dirname, "migrations", "manual_sparse_dense_hybrid.sql"),
    "utf8"
  )
  
  console.log("Running manual migration as a single script...")
  try {
    await prisma.$executeRawUnsafe(sql)
    console.log("Migration complete!")
  } catch (e) {
    console.error("Migration failed:", e)
  }
}

runAll()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
