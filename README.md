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
     escalates to BLOCK/HUMAN_REVIEW if still failing. An EDIT_CLARIFY rewrite is re-verified
     once and can only escalate the verdict, never soften it)
  -> Audit Engine writes the full trace to Postgres
  -> response returned to caller
```

### Latency

Every request makes at least one Gemini call, so it will never be instant, but the path is tuned:

- **Model is `gemini-2.5-flash-lite`** — the fastest 2.5 model, thinking off by default, and 15 RPM free-tier (vs 10 for Flash), which matters when one user message is 4–6 model calls.
- **Thinking is pinned off** (`thinkingConfig: { thinkingBudget: 0 }` in `server/src/llm/gemini.js`) on generation, the Judge, and transcription — belt-and-suspenders against an SDK default change.
- **The audit write is fire-and-forget** except on `HUMAN_REVIEW` (which needs the review id back). The trace is observability; the user doesn't wait on a Postgres insert.
- **The rate limiter** bursts to 6 tokens, refilling 1 per 4.5s (~13/min, just under Flash-Lite's 15 RPM). Was 1 per 7s. Pacing in our own bucket beats overshooting into Gemini's 429 + the 2/4/8s retry backoff.
- **`.github/workflows/keepalive.yml`** pings `/health` every 10 min so the Render free instance doesn't spin down and cold-start (~50–130s) on the next real request. `render.yaml` also sets `healthCheckPath: /health`.
- **CORS** is pinned to `CLIENT_ORIGIN` (when set) with `maxAge: 86400`, so the browser stops re-issuing an `OPTIONS` preflight before every `POST`.
- Per-stage timings (`retrievalMs`, `generationMs`, `verificationMs`, `auditMs`) are in every generate response and on the Efficiency page, so "why was that slow" is answerable at a glance.

### Model pinning

`GEMINI_MODEL` in `server/src/llm/gemini.js` is the **single** place a model name appears, and it
is pinned to `gemini-2.5-flash` on purpose — do not float it to "latest". A governance gateway
makes several model calls per user message (generation, regenerate retries, the EDIT/CLARIFY pass,
the Judge, CBG counterfactuals), so model choice multiplies through the whole request; 2.5 Flash is
cheap and fast enough to keep verification depth affordable while still being a credible
independent Judge. The audit trace reads the model off the provider rather than repeating the
literal, so a trace can never claim a model that didn't run.

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
- **VCO** (Verification Cost Overhead, system-level) — `governance tokens ÷ baseline tokens`.
  Baseline is the single call the app would have made with no gateway; governance is everything
  TripWire added (regenerate retries, EDIT/CLARIFY, the Judge, CBG). Per-request in the generate
  response, aggregated at `GET /api/v1/stats`. See `server/src/utils/tokens.js`.

### Embeddings

`server/src/llm/localEmbed.js` — a deterministic 256-dim hashed embedding (unigrams + bigrams,
sublinear TF, signed hashing, stopword removal, light stemming). No embeddings API is ever called:
`embed()` runs once per response, once per evidence chunk, and twice more for CBG, so metering it
would turn one quota-relevant request into dozens.

It is deliberately a **pure function of its input**. Chunk embeddings are written once at seed time
and compared against a query embedding computed at runtime, so anything corpus-dependent (true IDF,
a learned vocabulary) would drift between those two moments. Changing the embedder invalidates every
stored vector — `npm run seed` detects the dimension mismatch and re-embeds, and the retrieval path
logs a loud warning if it ever sees a stale corpus (cosine returns 0 on a dimension mismatch, which
would otherwise look like a metric bug rather than a data problem).

### Storage: Postgres via Prisma (not MongoDB)

`server/prisma/schema.prisma` — `Policy`, `AuditTrace`, `HumanReview`, `FeedbackRecord`,
`EvidenceDocument`, `EvidenceChunk`. Evidence similarity is cosine similarity computed in
application code (`server/src/evidence/store.js`) against a `Json` float array — no pgvector
extension required for this MVP.

### Dashboard (`client/src/pages/`)

- **Inspector** — chat surface plus the per-request trace: verdict, policy, mode, reasons, the 10
  core metrics with SchemaX's ES/SQ/SC breakdown, retrieved evidence, Judge rationale, and the
  per-request cost strip (latency, baseline vs governance tokens, VCO). Carries the four
  one-click demo scenarios from spec point 38.
- **Efficiency & Cost** — latency P50/P95, VCO, regeneration / Judge-invocation / block rates,
  verification-depth distribution, baseline-vs-governance token split.
- **Audit Trace** — filterable trace list; select one to reconstruct the full decision.
- **Human Review** — the escalation queue.
- **Feedback & Metrics** — precision/recall/FPR/FNR and the confusion matrix.
- **Settings & Policies** — hard gates, threshold rules, risk tolerance and geography.

### Reversed false-positive/false-negative convention (explicit product requirement)

`server/src/feedback/feedbackEngine.js` implements this intentionally **reversed** from the
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
  (`client/src/components/ui.jsx`) instead.
- **A real sentence-transformer**: a local ONNX MiniLM would beat the hashed embedder comfortably,
  at the cost of a ~90MB model download and a native dependency. Swap it in behind `localEmbed`'s
  signature and re-seed.
- **Auth**: the governance endpoints (`PATCH /policies/:id`, `POST /review/:id/decision`) are
  unauthenticated and CORS is open. Fine for a local prototype, not for a shared deployment.

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

The client dev server proxies `/api/*` to `http://localhost:4000` (see `client/vite.config.js`,
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

- **Server**: `render.yaml` (repo root) is the current config — a Render web service rooted at
  `server/`, running `prisma db push && npm run seed && npm start`, plus a free Postgres instance.
  `server/railway.json` is the older Railway config, kept as an alternative. Either way, set
  `DATABASE_URL` and `GEMINI_API_KEY` as environment variables.
- **Client**: deploys to Vercel using its built-in Vite preset — no extra config needed. Set
  `VITE_API_URL` to the deployed server URL as a Vercel environment variable.

This environment does not have interactive `railway`/`vercel` CLI login available, so no deploy
was actually run — only the config for a human to run `railway up` / connect the Vercel project.
