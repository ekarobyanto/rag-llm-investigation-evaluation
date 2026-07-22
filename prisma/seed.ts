import { config } from "dotenv"
config()

import { PrismaClient } from "@prisma/client"
import { generateEmbedding } from "../lib/embedding"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

const prisma = new PrismaClient()

interface InputCase {
  case: { title: string; description: string }
  suspects: Array<{ name: string; profile: string }>
  evidence: Array<{
    type: string
    category: string
    difficulty_weight: number
    content: string
  }>
  ground_truth: {
    correct_suspect_name: string
    contradiction_pairs: Array<{
      evidence_index_1?: number
      evidence_index_2?: number
      claim_evidence_index?: number
      contradicting_evidence_index?: number
      explanation: string
    }>
    relevant_evidence_indices: number[]
    optimal_next_actions: Array<
      | string
      | { action_type: string; target?: string; reason?: string }
    >
  }
}

function loadCases(): InputCase[] {
  const dir = join(process.cwd(), "cases-input")
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"))
  const cases: InputCase[] = []

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"))
    if (raw.case && raw.suspects && raw.evidence) {
      cases.push(raw as InputCase)
    } else {
      for (const key of Object.keys(raw)) {
        const entry = raw[key]
        if (entry?.case && entry?.suspects && entry?.evidence) {
          cases.push(entry as InputCase)
        }
      }
    }
  }

  return cases
}

function normalizeContradiction(p: any) {
  return {
    evidence_index_1: p.evidence_index_1 ?? p.evidence_index_a ?? p.claim_evidence_index ?? -1,
    evidence_index_2: p.evidence_index_2 ?? p.evidence_index_b ?? p.contradicting_evidence_index ?? -1,
    explanation: p.explanation,
  }
}

function normalizeAction(
  a: string | { action_type: string; target?: string; reason?: string },
  correctSuspectName: string
) {
  if (typeof a === "string") {
    return {
      action_type: a,
      target: correctSuspectName,
      reason: "Author-defined optimal action",
    }
  }
  return {
    action_type: a.action_type,
    target: a.target ?? correctSuspectName,
    reason: a.reason ?? "Author-defined optimal action",
  }
}

async function clearDatabase() {
  await prisma.aIInteractionLog.deleteMany()
  await prisma.investigationLog.deleteMany()
  await prisma.investigationSession.deleteMany()
  await prisma.caseGroundTruth.deleteMany()
  await prisma.evidence.deleteMany()
  await prisma.suspect.deleteMany()
  await prisma.case.deleteMany()
  console.log("Cleared existing data")
}

async function seed() {
  console.log("Loading cases from cases-input/")
  const cases = loadCases()
  console.log(`Found ${cases.length} cases`)

  if (cases.length === 0) {
    console.error("No cases found. Aborting.")
    process.exit(1)
  }

  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 0)
  if (!hasOpenAIKey) {
    console.warn("OPENAI_API_KEY missing — evidence will be seeded WITHOUT embeddings")
  }

  await clearDatabase()

  for (const caseData of cases) {
    const createdCase = await prisma.case.create({
      data: {
        title: caseData.case.title,
        description: caseData.case.description,
      },
    })
    console.log(`\nCreated case: ${createdCase.title}`)

    const suspectMap = new Map<string, string>()
    for (const suspect of caseData.suspects) {
      const created = await prisma.suspect.create({
        data: {
          caseId: createdCase.id,
          name: suspect.name,
          profile: suspect.profile,
        },
      })
      suspectMap.set(suspect.name, created.id)
    }
    console.log(`  Created ${caseData.suspects.length} suspects`)

    const evidenceIds: string[] = []
    for (const [idx, evidence] of caseData.evidence.entries()) {
      const created = await prisma.evidence.create({
        data: {
          caseId: createdCase.id,
          type: evidence.type,
          category: evidence.category,
          difficultyWeight: evidence.difficulty_weight,
          content: evidence.content,
        },
      })
      evidenceIds.push(created.id)

      if (hasOpenAIKey) {
        try {
          const embedding = await generateEmbedding(evidence.content)
          await prisma.$executeRaw`
            UPDATE evidence
            SET embedding = ${JSON.stringify(embedding)}::vector
            WHERE id = ${created.id}
          `
        } catch (error) {
          console.error(`  Embedding failed for evidence #${idx}: ${error}`)
        }
      }
    }
    console.log(`  Created ${caseData.evidence.length} evidence items${hasOpenAIKey ? " (with embeddings)" : ""}`)

    const gt = caseData.ground_truth
    const correctSuspectId = suspectMap.get(gt.correct_suspect_name)
    if (!correctSuspectId) {
      console.error(`  Ground truth references unknown suspect: ${gt.correct_suspect_name} — skipping ground truth`)
      continue
    }

    const contradictionPairsMapped = gt.contradiction_pairs.map((p) => {
      const norm = normalizeContradiction(p)
      return {
        evidence_id_1: evidenceIds[norm.evidence_index_1] ?? null,
        evidence_id_2: evidenceIds[norm.evidence_index_2] ?? null,
        explanation: norm.explanation,
      }
    })

    const relevantEvidenceIds = gt.relevant_evidence_indices
      .map((i) => evidenceIds[i])
      .filter(Boolean)

    const optimalNextActions = gt.optimal_next_actions.map((a) =>
      normalizeAction(a, gt.correct_suspect_name)
    )

    await prisma.caseGroundTruth.create({
      data: {
        caseId: createdCase.id,
        correctSuspectId,
        contradictionPairs: contradictionPairsMapped,
        relevantEvidenceIds,
        optimalNextActions,
      },
    })
    console.log(`  Created ground truth`)
  }

  console.log("\nSeed completed successfully")
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
