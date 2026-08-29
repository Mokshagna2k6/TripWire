import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

const { PrismaClient } = await import("@prisma/client");
const { GeminiProvider } = await import("../src/llm/gemini.js");

const prisma = new PrismaClient();
const provider = new GeminiProvider();

const POLICIES = [
  {
    name: "general",
    domain: "general",
    geography: "global",
    riskTolerance: "medium",
    hardGates: { pls: 4, shs: 4 },
    thresholds: [
      { metric: "uis", operator: ">=", value: 4, action: "REGENERATE" },
      { metric: "ceg", operator: ">=", value: 4, action: "HUMAN_REVIEW" },
      { metric: "errorDensity", operator: ">=", value: 3, action: "EDIT_CLARIFY" },
      { metric: "schemaX", operator: "<", value: 0.4, action: "REGENERATE" },
      { metric: "cur", operator: "<", value: 0.1, action: "REGENERATE" },
      { metric: "rre", operator: "<", value: 0.2, action: "REGENERATE" },
      { metric: "sas", operator: ">=", value: 0.85, action: "REGENERATE" },
      { metric: "cbg", operator: ">=", value: 0.6, action: "HUMAN_REVIEW" },
      { metric: "hallucinationRisk", operator: ">=", value: 0.7, action: "HUMAN_REVIEW" },
      { metric: "ro", operator: ">=", value: 1, action: "HUMAN_REVIEW" },
    ],
    allowedActions: ["ALLOW", "EDIT_CLARIFY", "REGENERATE", "BLOCK", "HUMAN_REVIEW"],
  },
  {
    name: "finance_india",
    domain: "finance_india",
    geography: "IN",
    riskTolerance: "low",
    hardGates: { pls: 4, shs: 4 },
    thresholds: [
      { metric: "uis", operator: ">=", value: 4, action: "REGENERATE" },
      { metric: "ceg", operator: ">=", value: 4, action: "HUMAN_REVIEW" },
      { metric: "schemaX", operator: "<", value: 0.5, action: "HUMAN_REVIEW" },
      { metric: "cur", operator: "<", value: 0.1, action: "REGENERATE" },
      { metric: "rre", operator: "<", value: 0.2, action: "HUMAN_REVIEW" },
      { metric: "sas", operator: ">=", value: 0.8, action: "HUMAN_REVIEW" },
      { metric: "cbg", operator: ">=", value: 0.5, action: "HUMAN_REVIEW" },
      { metric: "hallucinationRisk", operator: ">=", value: 0.6, action: "HUMAN_REVIEW" },
      { metric: "ro", operator: ">=", value: 1, action: "HUMAN_REVIEW" },
    ],
    allowedActions: ["ALLOW", "EDIT_CLARIFY", "REGENERATE", "BLOCK", "HUMAN_REVIEW"],
  },
  {
    name: "medical",
    domain: "medical",
    geography: "global",
    riskTolerance: "low",
    hardGates: { pls: 3, shs: 3 },
    thresholds: [
      { metric: "uis", operator: ">=", value: 2, action: "HUMAN_REVIEW" },
      { metric: "ceg", operator: ">=", value: 3, action: "HUMAN_REVIEW" },
      { metric: "schemaX", operator: "<", value: 0.6, action: "REGENERATE" },
      { metric: "cur", operator: "<", value: 0.1, action: "HUMAN_REVIEW" },
      { metric: "rre", operator: "<", value: 0.2, action: "HUMAN_REVIEW" },
      { metric: "sas", operator: ">=", value: 0.7, action: "HUMAN_REVIEW" },
      { metric: "cbg", operator: ">=", value: 0.4, action: "HUMAN_REVIEW" },
      { metric: "hallucinationRisk", operator: ">=", value: 0.5, action: "HUMAN_REVIEW" },
      { metric: "ro", operator: ">=", value: 1, action: "HUMAN_REVIEW" },
    ],
    allowedActions: ["ALLOW", "EDIT_CLARIFY", "REGENERATE", "HUMAN_REVIEW", "BLOCK"],
  },
  {
    name: "enterprise",
    domain: "enterprise",
    geography: "global",
    riskTolerance: "medium",
    hardGates: { pls: 4, shs: 4 },
    thresholds: [
      { metric: "uis", operator: ">=", value: 4, action: "REGENERATE" },
      { metric: "errorDensity", operator: ">=", value: 4, action: "REGENERATE" },
      { metric: "cur", operator: "<", value: 0.1, action: "REGENERATE" },
      { metric: "rre", operator: "<", value: 0.2, action: "REGENERATE" },
      { metric: "sas", operator: ">=", value: 0.85, action: "REGENERATE" },
      { metric: "cbg", operator: ">=", value: 0.6, action: "HUMAN_REVIEW" },
      { metric: "hallucinationRisk", operator: ">=", value: 0.7, action: "HUMAN_REVIEW" },
      { metric: "ro", operator: ">=", value: 1, action: "HUMAN_REVIEW" },
    ],
    allowedActions: ["ALLOW", "EDIT_CLARIFY", "REGENERATE", "BLOCK", "HUMAN_REVIEW"],
  },
];

const DOCUMENTS = [
  {
    domain: "hr_travel",
    title: "Corporate Travel Policy 2026",
    source: "internal-handbook",
    authority: "high",
    text: "Employees booking domestic flights must use the approved travel portal and book economy class for trips under 5 hours. International flights over 8 hours may be booked in premium economy with manager approval. Reimbursement claims must be filed within 30 days of travel completion, accompanied by itemized receipts.",
  },
  {
    domain: "hr_travel",
    title: "Remote Work & Expense Guidelines",
    source: "internal-handbook",
    authority: "high",
    text: "Remote employees receive a monthly home-office stipend of up to 3000 INR for internet and equipment. Co-working space membership is reimbursable up to 8000 INR per month with prior HR approval. Personal travel is never reimbursable under any circumstance.",
  },
  {
    domain: "finance_india",
    title: "GST Filing Guidance for Small Business",
    source: "gst-council-public-guidance",
    authority: "high",
    text: "Businesses with annual turnover above 40 lakh INR (20 lakh for services) must register for GST. GSTR-3B returns are filed monthly by the 20th of the following month. Late filing attracts a penalty of 50 INR per day, capped at 5000 INR per return.",
  },
  {
    domain: "finance_india",
    title: "Income Tax Slabs FY 2025-26 (New Regime)",
    source: "income-tax-department-public-notice",
    authority: "high",
    text: "Under the new tax regime for FY 2025-26, income up to 3 lakh INR is tax-free. Income between 3-7 lakh is taxed at 5%, 7-10 lakh at 10%, 10-12 lakh at 15%, 12-15 lakh at 20%, and above 15 lakh at 30%. A standard deduction of 75000 INR applies to salaried individuals.",
  },
  {
    domain: "finance_india",
    title: "SEBI Investor Advisory on Mutual Funds",
    source: "sebi-investor-education",
    authority: "medium",
    text: "Mutual fund investments are subject to market risk and past performance does not guarantee future returns. SEBI mandates that all mutual fund advertisements carry this disclosure prominently. Investors should read the scheme information document carefully before investing.",
  },
  // The medical policy is the strictest one seeded, but it had no corpus behind
  // it — so medical prompts were exercising no-evidence behaviour (spec 22) by
  // accident rather than deep verification against real evidence (spec 38).
  {
    domain: "medical",
    title: "Occupational Health Guidance for Employees",
    source: "internal-occupational-health",
    authority: "high",
    text: "Employees reporting persistent fever above 38 degrees Celsius must consult the occupational health desk before returning to the workplace. This guidance covers workplace fitness assessment only and is not a substitute for diagnosis or treatment by a qualified physician. Medication dosage decisions must always be made by a licensed medical practitioner.",
  },
  {
    domain: "medical",
    title: "Employee Medical Leave and Escalation Policy",
    source: "internal-hr-medical",
    authority: "medium",
    text: "Medical leave beyond three consecutive days requires a certificate from a registered practitioner. Requests involving prescription medication, dosage guidance, or treatment plans are outside the scope of this policy and must be escalated to a human reviewer. No automated system may issue clinical advice to an employee.",
  },
];

async function main() {
  for (const p of POLICIES) {
    await prisma.policy.upsert({
      where: { name: p.name },
      update: p,
      create: p,
    });
  }
  console.log(`seeded ${POLICIES.length} policies`);

  // Retrieval compares a runtime query embedding against these stored vectors, so
  // a change to the embedder invalidates every chunk written by an earlier seed.
  // Cosine similarity returns 0 on a dimension mismatch rather than erroring, so
  // a stale corpus fails silently — detect it here and re-embed.
  const expectedDims = (await provider.embed("dimension probe")).length;

  let created = 0;
  let refreshed = 0;
  for (const doc of DOCUMENTS) {
    const existing = await prisma.evidenceDocument.findFirst({
      where: { title: doc.title },
      include: { chunks: { take: 1 } },
    });

    if (existing) {
      const storedDims = existing.chunks[0]?.embedding?.length ?? 0;
      if (storedDims === expectedDims) continue;
      // Stale embeddings: drop the chunks and rebuild them against this document.
      await prisma.evidenceChunk.deleteMany({ where: { documentId: existing.id } });
      await embedInto(existing.id, doc.text);
      refreshed++;
      continue;
    }

    const document = await prisma.evidenceDocument.create({
      data: { domain: doc.domain, title: doc.title, source: doc.source, authority: doc.authority },
    });
    await embedInto(document.id, doc.text);
    created++;
  }
  console.log(
    `evidence documents: ${created} created, ${refreshed} re-embedded, ${DOCUMENTS.length - created - refreshed} already current`
  );
}

/** Chunk by sentence for finer-grained retrieval, then embed each chunk. */
async function embedInto(documentId, text) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  for (const sentence of sentences) {
    const embedding = await provider.embed(sentence);
    await prisma.evidenceChunk.create({ data: { documentId, text: sentence, embedding } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
