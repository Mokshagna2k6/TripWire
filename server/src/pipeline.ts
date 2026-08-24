import { randomUUID } from "node:crypto";
import type { LLMProvider } from "./llm/provider.js";
import { classifyPreRisk } from "./orchestrator/preRiskRouter.js";
import { optimizeContext } from "./orchestrator/contextOptimizer.js";
import { runVerification } from "./orchestrator/verificationOrchestrator.js";
import { loadPolicy } from "./policy/policyEngine.js";
import { evaluateRisk, type RiskDecision } from "./risk/riskEngine.js";
import { recordAuditTrace } from "./audit/auditEngine.js";
import { prisma } from "./db.js";
import {
  MAX_REGENERATE_RETRIES,
  buildCorrectiveFeedbackPrompt,
  buildEditClarifyPrompt,
  escalateAfterRetries,
} from "./actions/actionHandler.js";

export interface GenerateRequest {
  domain: string;
  prompt: string;
  expectedFormat?: { format?: "json"; requiredFields?: string[] };
}

export interface GenerateResult {
  requestId: string;
  action: RiskDecision["action"];
  riskLevel: RiskDecision["riskLevel"];
  reasons: string[];
  response: string | null; // null when BLOCKed or pending HUMAN_REVIEW
  regenerationCount: number;
  humanReviewId?: string;
  metrics: unknown;
  evidence: unknown;
  judgeOutput: unknown;
  preRiskMode: string;
}

/**
 * The Trust Gateway: pre-risk routing -> context optimization -> Gemini call ->
 * hold raw response -> adaptive verification -> policy/risk -> action handling
 * (with a bounded regenerate loop) -> audit trace. This is the one place the
 * whole flow described in the spec is wired together end to end.
 */
export async function runPipeline(req: GenerateRequest, provider: LLMProvider): Promise<GenerateResult> {
  const startedAt = Date.now();
  const requestId = randomUUID();

  const policy = await loadPolicy(req.domain);
  const preRisk = classifyPreRisk(req.domain, req.prompt, policy.riskTolerance);

  let prompt = req.prompt;
  let regenerationCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let responseText = "";
  let decision: RiskDecision;
  let verification: Awaited<ReturnType<typeof runVerification>>;

  const optimizedPrompt = optimizeContext(prompt, []); // ponytail: no evidence pre-retrieval before first call for MVP; evidence is fetched during verification against the response itself

  const first = await provider.generate(optimizedPrompt);
  responseText = first.text;
  totalInputTokens += first.tokens.input;
  totalOutputTokens += first.tokens.output;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    verification = await runVerification(
      {
        domain: req.domain,
        originalPrompt: req.prompt,
        responseText,
        mode: preRisk.mode,
        regenerationCount,
        maxRetries: MAX_REGENERATE_RETRIES,
        expectedFormat: req.expectedFormat,
      },
      provider
    );

    decision = evaluateRisk(verification.metrics, policy, verification.hardGate);

    if (decision.action !== "REGENERATE" || regenerationCount >= MAX_REGENERATE_RETRIES) {
      if (decision.action === "REGENERATE" && regenerationCount >= MAX_REGENERATE_RETRIES) {
        const escalated = escalateAfterRetries(verification.hardGate.triggered);
        decision = {
          riskLevel: escalated === "BLOCK" ? "critical" : "high",
          action: escalated,
          reasons: [...decision.reasons, `exhausted ${MAX_REGENERATE_RETRIES} regenerate retries, escalated to ${escalated}`],
        };
      }
      break;
    }

    regenerationCount++;
    const correctivePrompt = buildCorrectiveFeedbackPrompt(req.prompt, responseText, decision.reasons);
    const retry = await provider.generate(correctivePrompt);
    responseText = retry.text;
    totalInputTokens += retry.tokens.input;
    totalOutputTokens += retry.tokens.output;
  }

  if (decision.action === "EDIT_CLARIFY") {
    const editPrompt = buildEditClarifyPrompt(req.prompt, responseText, decision.reasons);
    const edited = await provider.generate(editPrompt);
    responseText = edited.text;
    totalInputTokens += edited.tokens.input;
    totalOutputTokens += edited.tokens.output;
  }

  const finalOutcome = decision.action === "BLOCK" ? "blocked" : decision.action === "HUMAN_REVIEW" ? "pending_review" : "delivered";

  const trace = await recordAuditTrace({
    requestId,
    policyId: policy.id,
    model: "gemini-2.0-flash",
    promptMeta: { domain: req.domain, preRiskMode: preRisk.mode, preRiskReasons: preRisk.reasons },
    rawResponse: responseText,
    structuredRepresentation: verification.structured,
    metrics: verification.metrics,
    evidence: verification.evidence,
    judgeOutput: verification.judgeOutput,
    decision,
    regenerationCount,
    latencyMs: Date.now() - startedAt,
    tokens: { input: totalInputTokens, output: totalOutputTokens },
    finalOutcome,
  });

  let humanReviewId: string | undefined;
  if (decision.action === "HUMAN_REVIEW") {
    const review = await prisma.humanReview.create({
      data: {
        auditTraceId: trace.id,
        risk: decision.riskLevel,
        reason: decision.reasons.join("; "),
        response: responseText,
        evidence: verification.evidence as unknown as object,
        metrics: verification.metrics as unknown as object,
      },
    });
    humanReviewId = review.id;
    await prisma.auditTrace.update({ where: { id: trace.id }, data: { humanReviewId } });
  }

  return {
    requestId,
    action: decision.action,
    riskLevel: decision.riskLevel,
    reasons: decision.reasons,
    response: decision.action === "BLOCK" || decision.action === "HUMAN_REVIEW" ? null : responseText,
    regenerationCount,
    humanReviewId,
    metrics: verification.metrics,
    evidence: verification.evidence,
    judgeOutput: verification.judgeOutput,
    preRiskMode: preRisk.mode,
  };
}
