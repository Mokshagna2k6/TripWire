import { PrismaClient } from "@prisma/client";
import { GeminiProvider } from "../src/llm/gemini.js";

const prisma = new PrismaClient();

// ponytail: deterministic 64-dim hashing embedding fallback so seeding works
// without a GEMINI_API_KEY (e.g. CI/local dev). Swap for provider.embed() below
// once a real key is available — cosine similarity still works fine on it.
function localEmbed(text) {
  const dims = 64;
  const vec = new Array(dims).fill(0);
  for (const word of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) hash = (hash * 31 + word.charCodeAt(i)) >>> 0;
    vec[hash % dims] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function embed(text) {
  if (!process.env.GEMINI_API_KEY) return localEmbed(text);
  try {
    return await new GeminiProvider().embed(text);
  } catch {
    return localEmbed(text);
  }
}

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

  for (const doc of DOCUMENTS) {
    const existing = await prisma.evidenceDocument.findFirst({ where: { title: doc.title } });
    if (existing) continue;

    const created = await prisma.evidenceDocument.create({
      data: { domain: doc.domain, title: doc.title, source: doc.source, authority: doc.authority },
    });

    // Chunk by sentence for finer-grained retrieval.
    const sentences = doc.text.split(/(?<=[.!?])\s+/).filter(Boolean);
    for (const sentence of sentences) {
      const embedding = await embed(sentence);
      await prisma.evidenceChunk.create({
        data: { documentId: created.id, text: sentence, embedding },
      });
    }
  }
  console.log(`seeded ${DOCUMENTS.length} evidence documents`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
