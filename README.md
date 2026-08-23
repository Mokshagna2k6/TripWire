# TripWire AI

An AI governance gateway that sits between an app and the Gemini LLM API. It holds the raw LLM
response before returning it to the caller, runs risk-adaptive verification, applies policy, and
decides **ALLOW / EDIT_CLARIFY / REGENERATE / BLOCK / HUMAN_REVIEW**.

## Architecture

```
POST /api/v1/generate
  -> Express Trust Gateway
  -> pre-risk router (domain + prompt -> FAST/STANDARD/DEEP mode)
  -> context optimizer (trims/ranks retrieved evidence into the prompt)
  -> Gemini API call
  -> HOLD RAW RESPONSE
  -> Response Analyzer (claims, entities, citations, structure, intent, key spans)
  -> Fast Detectors in parallel (PII, secrets, schema, basic safety)
  -> Hard Gate check (confirmed credential leak / severe PII / severe safety = immediate BLOCK,
     recorded in trace, no further scoring)
  -> if no hard gate: Adaptive Verification Orchestrator runs the metric set for the assigned mode
  -> Policy Engine loads policy from Postgres
  -> Risk Engine combines metrics + hard gates + Judge output (DEEP only) + policy
     -> risk_level + action + reasons
  -> Action Handler executes (regenerate loop, max_retries=2, with a corrective feedback prompt;
     escalates to BLOCK/HUMAN_REVIEW if still failing)
  -> Audit Engine writes the full trace to Postgres
  -> response returned to caller
```

### Core metrics (`server/src/metrics/`)

10 core + 1 auxiliary metric, all real logic (no fake numbers):

- **SchemaX** = 0.5·ES + 0.25·SQ + 0.25·SC — evidence support, source quality, schema compliance
- **UIS** (Unsupported Inference Score) — conclusions not backed by retrieved evidence
- **CEG** (Confidence-Evidence Gap) — `|implied confidence - evidence support|`
- **Error Density** — structural/textual anomaly rate
- **CUR** (Context Utilization Rate) — share of retrieved evidence actually used
- **RO** (Rework Overhead) — regeneration budget consumed
- **RRE** (Retrieval Retention Efficacy) — highly relevant evidence that survived into the output
- **PLS** (PII/Secret Leakage Score, 0-5) — wraps the PII/secrets fast detectors, hard-gates at high severity
- **CBG** (Counterfactual Bias Gap) — only run on ~8% sampled traffic or explicitly high-risk requests
- **SHS** (Safety/Harm Score, 0-5) — Layer 1 deterministic rules, Layer 2 AI-Judge in DEEP mode
- **SAS** (Semantic Anomaly Score, auxiliary) — embedding-distance signal, feeds risk but never gates alone

### Storage: Postgres via Prisma (not MongoDB)

`server/prisma/schema.prisma` — `Policy`, `AuditTrace`, `HumanReview`, `FeedbackRecord`,
`EvidenceDocument`, `EvidenceChunk`. Evidence similarity is cosine similarity computed in
application code (`server/src/evidence/store.ts`) against a `Json` float array — no pgvector
extension required for this MVP.

### Reversed false-positive/false-negative convention (explicit product requirement)

`server/src/feedback/feedbackEngine.ts` implements this intentionally **reversed** from the
textbook "flag = positive" convention:

- system **BLOCK** + human **ALLOW** = **false_negative**
- system **ALLOW** + human **BLOCK** = **false_positive**

This is a deliberate deviation, not a bug — do not "fix" it back to the standard convention.

### What's deliberately out of scope for this MVP

- **Redis/BullMQ**: skipped entirely (no dependency, no docker service). Modules are structured
  with clean boundaries so a caching layer or offline job queue could sit behind them later —
  look for `// ponytail:` comments marking where.
- **pgvector**: cosine similarity is computed in application code instead (see above).
- **shadcn/ui CLI scaffolding**: the dashboard uses a handful of hand-written Tailwind primitives
  (`client/src/components/ui.tsx`) instead.

## Running locally

### Option A: Docker Compose (Postgres + server + client)

```sh
cp .env.example .env   # fill in GEMINI_API_KEY
docker compose up --build
```

- Client: http://localhost:5173
- Server: http://localhost:4000
- Postgres: localhost:5432

### Option B: run natively

```sh
# 1. Start Postgres (or point DATABASE_URL at any Postgres instance)
docker run -d -p 5432:5432 -e POSTGRES_USER=tripwire -e POSTGRES_PASSWORD=tripwire -e POSTGRES_DB=tripwire postgres:16-alpine

# 2. Server
cd server
cp ../.env.example .env   # fill in GEMINI_API_KEY, adjust DATABASE_URL if needed
npm install
npx prisma db push
npm run seed
npm run dev

# 3. Client (separate terminal)
cd client
npm install
npm run dev
```

The client dev server proxies `/api/*` to `http://localhost:4000` (see `client/vite.config.ts`,
override with `VITE_API_URL`).

## Testing

```sh
cd server
npm test
```

Unit/API tests use Vitest (+ Supertest for the Express surface) with a mocked `LLMProvider`, so
no live Gemini key or Postgres connection is required to run them. Covered: PII/secret detection,
the hard-gate short-circuit, policy-threshold action selection, and the reversed feedback
classification convention.

## Deployment

- **Server**: `server/railway.json` is a minimal Railway config (Nixpacks build, `prisma db push`
  + `npm start` on deploy). Set `DATABASE_URL` and `GEMINI_API_KEY` as Railway env vars.
- **Client**: deploys to Vercel using its built-in Vite preset — no extra config needed. Set
  `VITE_API_URL` to the deployed server URL as a Vercel environment variable.

This environment does not have interactive `railway`/`vercel` CLI login available, so no deploy
was actually run — only the config for a human to run `railway up` / connect the Vercel project.
