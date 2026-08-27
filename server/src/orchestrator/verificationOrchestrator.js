import { analyzeResponse } from "../analyzer/responseAnalyzer.js";
import { runFastDetectors, checkHardGate } from "../detectors/index.js";
import { retrieveEvidence } from "../evidence/store.js";
import { computeMetrics } from "../metrics/index.js";
import { runJudge } from "../judge/judge.js";
import { computeCBG, hasProtectedAttribute, shouldSampleCBG, stableSample } from "../metrics/cbg.js";

/**
 * Adaptive Verification Orchestrator: fast detectors + hard gate always run.
 * Beyond that, verification depth scales with the pre-risk mode:
 *  - FAST: core lexical metrics only, no evidence retrieval, no judge.
 *  - STANDARD: + evidence retrieval/RAG comparison metrics.
 *  - DEEP: + AI Judge pass and (sampled) counterfactual bias check.
 */
export async function runVerification(input, provider) {
  const structured = analyzeResponse(input.responseText);
  const fastDetectors = runFastDetectors(input.responseText, input.expectedFormat);
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
    return { metrics, evidence: [], hardGate, judgeOutput: null, structured };
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

  let judgePromise = Promise.resolve(null);
  if (input.mode === "DEEP" && isFirstPass) {
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
  const [responseEmbedding, evidenceEmbeddings, judgeOutput, cbgValue] = await Promise.all([
    embedResponsePromise,
    embedEvidencePromise,
    judgePromise,
    cbgPromise,
  ]);

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

  metrics.cbg = cbgValue;

  return { metrics, evidence, hardGate, judgeOutput, structured };
}
