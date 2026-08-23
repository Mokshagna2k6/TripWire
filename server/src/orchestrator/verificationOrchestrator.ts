import type { LLMProvider } from "../llm/provider.js";
import type { VerificationMode } from "./preRiskRouter.js";
import { analyzeResponse } from "../analyzer/responseAnalyzer.js";
import { runFastDetectors, checkHardGate } from "../detectors/index.js";
import { retrieveEvidence, type RetrievedChunk } from "../evidence/store.js";
import { computeMetrics, type MetricsBundle } from "../metrics/index.js";
import { runJudge, type JudgeOutput } from "../judge/judge.js";
import { computeCBG, shouldSampleCBG } from "../metrics/cbg.js";

export interface VerificationInput {
  domain: string;
  originalPrompt: string;
  responseText: string;
  mode: VerificationMode;
  regenerationCount: number;
  maxRetries: number;
  expectedFormat?: { format?: "json"; requiredFields?: string[] };
}

export interface VerificationResult {
  metrics: MetricsBundle;
  evidence: RetrievedChunk[];
  hardGate: ReturnType<typeof checkHardGate>;
  judgeOutput: JudgeOutput | null;
  structured: ReturnType<typeof analyzeResponse>;
}

/**
 * Adaptive Verification Orchestrator: fast detectors + hard gate always run.
 * Beyond that, verification depth scales with the pre-risk mode:
 *  - FAST: core lexical metrics only, no evidence retrieval, no judge.
 *  - STANDARD: + evidence retrieval/RAG comparison metrics.
 *  - DEEP: + AI Judge pass and (sampled) counterfactual bias check.
 */
export async function runVerification(input: VerificationInput, provider: LLMProvider): Promise<VerificationResult> {
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
    input.mode === "FAST" ? [] : await retrieveEvidence(input.domain, input.originalPrompt + " " + input.responseText, provider);

  let judgeOutput: JudgeOutput | null = null;
  if (input.mode === "DEEP") {
    judgeOutput = await runJudge(input.responseText, evidence, provider);
  }

  const metrics = computeMetrics({
    responseText: input.responseText,
    structured,
    evidence,
    fastDetectors,
    regenerationCount: input.regenerationCount,
    maxRetries: input.maxRetries,
    judgeOutput: judgeOutput ?? undefined,
  });

  if (input.mode === "DEEP" && shouldSampleCBG(true)) {
    metrics.cbg = await computeCBG(input.originalPrompt, input.responseText, provider);
  } else if (input.mode !== "FAST" && shouldSampleCBG(false)) {
    metrics.cbg = await computeCBG(input.originalPrompt, input.responseText, provider);
  }

  return { metrics, evidence, hardGate, judgeOutput, structured };
}
