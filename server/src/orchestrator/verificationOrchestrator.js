import { analyzeResponse } from "../analyzer/responseAnalyzer.js";
import { runFastDetectors, checkHardGate } from "../detectors/index.js";
import { retrieveEvidence } from "../evidence/store.js";
import { computeMetrics } from "../metrics/index.js";
import { computeSchemaX } from "../metrics/schemaX.js";
import { runJudge } from "../judge/judge.js";
import { computeCBG, hasProtectedAttribute, shouldSampleCBG, stableSample } from "../metrics/cbg.js";
import { ZERO_TOKENS, addTokens } from "../utils/tokens.js";

// Below this local evidenceSupport, the response isn't confidently well-grounded on lexical
// matching alone — worth a real Judge read. At or above it, local scoring already agrees the
// response looks solid.
const WELL_GROUNDED_THRESHOLD = 0.8;

/**
 * Adaptive Verification Orchestrator: fast detectors + hard gate always run.
 * Beyond that, verification depth scales with the pre-risk mode:
 *  - FAST: core lexical metrics only, no evidence retrieval, no judge.
 *  - STANDARD: + evidence retrieval/RAG comparison metrics.
 *  - DEEP: + AI Judge pass and (sampled) counterfactual bias check.
 */
export async function runVerification(input, provider) {
  const structured = analyzeResponse(input.responseText);
  const regexDetectors = runFastDetectors(input.responseText, input.expectedFormat);

  // OR our independent regex layer with Gemini's own built-in safety classifier (free — already
  // computed on the generate() call we already made). Purely additive: either source can catch
  // something the other misses, but neither can override or suppress a hit the other source
  // found. Our regex still gates fully on its own merits with zero dependency on this signal.
  const combinedSafety = [...regexDetectors.safety, ...(input.geminiSafetyHits ?? [])];
  const fastDetectors = { ...regexDetectors, safety: combinedSafety };

  const hardGate = checkHardGate(fastDetectors);

  if (hardGate.triggered) {
    // Recorded in trace, no further scoring needed per spec.
    const metrics = computeMetrics({
      responseText: input.responseText,
      structured,
      evidence: [],
      fastDetectors,
      regenerationCount: input.regenerationCount,
      maxRetries: input.maxRetries,
    });
    // Early exit costs nothing in governance tokens — no Judge, no CBG. That zero
    // is itself the evidence that the hard-gate short-circuit works (spec 11 + 35).
    return { metrics, evidence: [], hardGate, judgeOutput: null, structured, governanceTokens: ZERO_TOKENS };
  }

  const evidence =
    input.mode === "FAST"
      ? []
      : input.initialEvidence ?? (await retrieveEvidence(input.domain, input.originalPrompt + " " + input.responseText, provider));

  // Judge and CBG are both extra LLM calls — only worth paying for once per request,
  // on the first pass. Re-running them on every regenerate retry multiplies latency.
  const isFirstPass = input.regenerationCount === 0;

  // Prepare promises to run concurrently
  const embedResponsePromise = provider.embed(input.responseText);
  const embedEvidencePromise = Promise.all(evidence.map((chunk) => provider.embed(chunk.text)));

  // Skip the Judge only when there's nothing on either axis it exists to check: Layer 1
  // safety found nothing at all, and the response already looks well-grounded on cheap local
  // scoring. Anything short of that — any safety hit, or weak/uncertain local grounding
  // (including "no evidence corpus to check against", which scores 0.5, below threshold) —
  // still gets the real Judge call, same as before. This only ever removes calls, it never
  // adds new ones — FAST/STANDARD mode is untouched.
  const localSchemaX = computeSchemaX(structured, evidence, fastDetectors.schema);
  const looksCleanLocally = fastDetectors.safety.length === 0 && localSchemaX.evidenceSupport >= WELL_GROUNDED_THRESHOLD;

  let judgePromise = Promise.resolve(null);
  if (input.mode === "DEEP" && isFirstPass && !looksCleanLocally) {
    judgePromise = runJudge(input.responseText, evidence, provider);
  }

  let cbgPromise = Promise.resolve(null);
  if (isFirstPass && hasProtectedAttribute(input.originalPrompt)) {
    const sample = stableSample(input.requestId);
    const isDeep = input.mode === "DEEP";
    if (shouldSampleCBG(isDeep, sample)) {
      cbgPromise = computeCBG(input.originalPrompt, input.responseText, provider);
    }
  }

  // Resolve all promises concurrently
  const [responseEmbedding, evidenceEmbeddings, judgeResult, cbgResult] = await Promise.all([
    embedResponsePromise,
    embedEvidencePromise,
    judgePromise,
    cbgPromise,
  ]);

  // Both are optional extra LLM calls; unwrap their verdicts and bank their cost.
  const judgeOutput = judgeResult?.output ?? null;
  const governanceTokens = addTokens(
    addTokens(ZERO_TOKENS, judgeResult?.tokens),
    cbgResult?.tokens
  );

  const metrics = computeMetrics({
    responseText: input.responseText,
    structured,
    evidence,
    fastDetectors,
    regenerationCount: input.regenerationCount,
    maxRetries: input.maxRetries,
    judgeOutput: judgeOutput ?? undefined,
    responseEmbedding,
    evidenceEmbeddings,
  });

  metrics.cbg = cbgResult?.value ?? null;

  return { metrics, evidence, hardGate, judgeOutput, structured, governanceTokens };
}
