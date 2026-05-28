import { PrismaClient } from "@prisma/client"
import { generateEmbedding } from "../lib/embedding"
import { CaseDataFormat } from "../lib/case-data"

const prisma = new PrismaClient()

// Sample cases - replace with your own generated cases
const sampleCases: CaseDataFormat[] = [
  {
    case: {
      title: "The Downtown Office Murder",
      description: "A high-profile executive found dead in their locked office. Investigate using evidence and suspect interviews to uncover the killer.",
    },
    suspects: [
      {
        name: "John Smith",
        profile: "VP of Operations, competitive with victim, recently passed over for promotion",
      },
      {
        name: "Sarah Johnson",
        profile: "Executive Assistant, had direct access to victim's office and schedule",
      },
      {
        name: "Michael Chen",
        profile: "Security Guard, on duty night of incident, claims standard patrol route",
      },
      {
        name: "Emma Williams",
        profile: "Receptionist, handled all visitors and calls, left early that day",
      },
    ],
    evidence: [
      {
        type: "witness_statement",
        content: "Sarah Johnson: 'I left at 5 PM sharp. John was still in the conference room. I did not see Emma after 4:30 PM.'",
      },
      {
        type: "cctv_log",
        content: "5:15 PM: John Smith exits main entrance carrying briefcase",
      },
      {
        type: "forensic_report",
        content: "Fingerprints on office door knob match Sarah Johnson and Michael Chen. No match to other suspects.",
      },
      {
        type: "email_message",
        content: "From John Smith 4:00 PM: 'Need to discuss promotion decision. This is unfair and I expect answers today.'",
      },
      {
        type: "financial_record",
        content: "Victim made $50,000 transfer to Michael Chen's sister's medical fund yesterday",
      },
      {
        type: "location_report",
        content: "Michael Chen security badge entry to executive floor at 5:45 PM - unusual for evening shift",
      },
      {
        type: "witness_statement",
        content: "Emma Williams: 'I was in break room until 5:30 PM then went home. John looked very angry when I passed his desk at 4:50.'",
      },
      {
        type: "cctv_log",
        content: "4:45 PM: Emma Williams visible in break room. No footage shows her on executive floor after 4:30 PM.",
      },
    ],
  },
  {
    case: {
      title: "The Museum Heist",
      description: "Priceless painting stolen from museum during gala opening. Multiple suspects with access and motive.",
    },
    suspects: [
      {
        name: "David Hart",
        profile: "Museum Director, recently denied promotion to assistant curator Marcus",
      },
      {
        name: "Marcus Williams",
        profile: "Assistant Curator, bitter about being passed over, knows all security procedures",
      },
      {
        name: "Lisa Park",
        profile: "Insurance Agent, processed high-value policy day before theft",
      },
      {
        name: "Tom Bradley",
        profile: "Security Chief, installed new system, has master access codes",
      },
      {
        name: "Rachel Green",
        profile: "Caterer, had basement access during setup, owes significant gambling debts",
      },
    ],
    evidence: [
      {
        type: "cctv_log",
        content: "8:45 PM: Painting visible on wall. 8:47 PM: Camera in east gallery goes offline for 3 minutes. 8:50 PM: Painting gone.",
      },
      {
        type: "witness_statement",
        content: "Tom Bradley: 'I performed rounds every 15 minutes. East gallery camera has been glitchy - I reported it twice this month.'",
      },
      {
        type: "email_message",
        content: "From Marcus to museum director: 'You promised me assistant director role this year. How could you give it to an outsider?'",
      },
      {
        type: "financial_record",
        content: "Rachel Green's banking records show $100,000 debt to organized crime figures, loans due tomorrow",
      },
      {
        type: "forensic_report",
        content: "Painting removed carefully - no force used on frame. Removed at specific angle only possible with curatorial knowledge.",
      },
      {
        type: "location_report",
        content: "Tom Bradley seen smoking outside at 8:42 PM, claims 10 minute break. Other staff confirm absence from main floor.",
      },
      {
        type: "witness_statement",
        content: "Lisa Park: 'Yes I processed the policy. These high-value paintings are insured regularly. Nothing unusual about timing.'",
      },
      {
        type: "email_message",
        content: "From David Hart to insurance company: 'Please expedite $5M claim for stolen painting. Museum needs immediate liquidity.'",
      },
      {
        type: "cctv_log",
        content: "8:30 PM: Rachel Green enters basement with catering supplies. 8:45 PM: Rachel seen heading toward east wing instead of kitchen.",
      },
    ],
  },
  {
    case: {
      title: "Corporate Espionage Ring",
      description: "Senior executive found passing trade secrets to competitor. Investigate who received classified information and how.",
    },
    suspects: [
      {
        name: "Victoria Cross",
        profile: "CFO, daughter recently rejected from expensive university, expensive lifestyle",
      },
      {
        name: "James Murphy",
        profile: "IT Director, recently demoted after project failure, looking for new employment",
      },
      {
        name: "Nina Patel",
        profile: "Head of R&D, contacted by competitor for consulting work last month",
      },
      {
        name: "Robert Liu",
        profile: "Legal Counsel, discovered accessing competitor's network from office computer",
      },
    ],
    evidence: [
      {
        type: "email_message",
        content: "From unknown account: 'Product specifications ready. Dead drop location: parking garage level 2. Usual payment: 500K.'",
      },
      {
        type: "financial_record",
        content: "Victoria Cross: Recent tuition payment ($85K), new luxury vehicle purchase ($120K), significant investment accounts",
      },
      {
        type: "witness_statement",
        content: "IT Assistant: 'James Murphy requested database access keys for systems he doesn't need. When questioned, he seemed nervous.'",
      },
      {
        type: "cctv_log",
        content: "11:30 PM James Murphy accessing R&D servers using admin credentials. Uncommon for evening hours.",
      },
      {
        type: "forensic_report",
        content: "Email trace: Unknown sender used VPN routed through competitor's network infrastructure. Server logs show external access.",
      },
      {
        type: "location_report",
        content: "Parking garage level 2 camera shows Victoria Cross parking at 10 PM, leaving package on ground 2 minutes later",
      },
      {
        type: "witness_statement",
        content: "Nina Patel: 'Competitor offered me consulting contract worth $200K. I declined but they seemed to already know our project timeline.'",
      },
      {
        type: "email_message",
        content: "From Robert Liu to IT: 'Found suspicious access on my account. Someone accessed encrypted files. Please investigate immediately.'",
      },
    ],
  },
]

async function seed() {
  console.log("Starting database seed...")

  try {
    // Clear existing data
    await prisma.aIInteractionLog.deleteMany()
    await prisma.investigationLog.deleteMany()
    await prisma.investigationSession.deleteMany()
    await prisma.evidence.deleteMany()
    await prisma.suspect.deleteMany()
    await prisma.case.deleteMany()

    console.log("Cleared existing data")

    // Seed cases with evidence
    for (const caseData of sampleCases) {
      const createdCase = await prisma.case.create({
        data: {
          title: caseData.case.title,
          description: caseData.case.description,
        },
      })

      console.log(`Created case: ${createdCase.title}`)

      // Create suspects
      for (const suspect of caseData.suspects) {
        await prisma.suspect.create({
          data: {
            caseId: createdCase.id,
            name: suspect.name,
            profile: suspect.profile,
          },
        })
      }

      console.log(`  Created ${caseData.suspects.length} suspects`)

      // Create evidence with embeddings
      for (const evidence of caseData.evidence) {
        try {
          const embedding = await generateEmbedding(evidence.content)
          await prisma.evidence.create({
            data: {
              caseId: createdCase.id,
              type: evidence.type,
              content: evidence.content,
              embedding,
            },
          })
        } catch (error) {
          console.error(`Failed to create evidence: ${error}`)
          // Create without embedding if API fails
          await prisma.evidence.create({
            data: {
              caseId: createdCase.id,
              type: evidence.type,
              content: evidence.content,
            },
          })
        }
      }

      console.log(`  Created ${caseData.evidence.length} evidence items`)
    }

    console.log("✅ Seed completed successfully")
  } catch (error) {
    console.error("❌ Seed failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

seed()
