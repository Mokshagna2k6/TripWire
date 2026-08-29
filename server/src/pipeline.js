import { randomUUID } from "node:crypto";
import { classifyPreRisk } from "./orchestrator/preRiskRouter.js";
import { optimizeContext } from "./orchestrator/contextOptimizer.js";
import { runVerification } from "./orchestrator/verificationOrchestrator.js";
import { loadPolicy } from "./policy/policyEngine.js";
import { retrieveEvidence } from "./evidence/store.js";
import { evaluateRisk, ACTION_SEVERITY } from "./risk/riskEngine.js";
import { recordAuditTrace } from "./audit/auditEngine.js";
import { prisma } from "./db.js";
import {
  MAX_REGENERATE_RETRIES,
  buildCorrectiveFeedbackPrompt,
  buildEditClarifyPrompt,
  escalateAfterRetries,
} from "./actions/actionHandler.js";
import { ZERO_TOKENS, addTokens, computeVCO } from "./utils/tokens.js";

/**
 * The Trust Gateway: pre-risk routing -> context optimization -> LLM call ->
 * hold raw response -> adaptive verification -> policy/risk -> action handling
 * (with a bounded regenerate loop) -> audit trace. This is the one place the
 * whole flow described in the spec is wired together end to end.
 */
export async function runPipeline(req, provider) {
  const startedAt = Date.now();
  const requestId = randomUUID();

  const policy = await loadPolicy(req.domain);
  const preRisk = classifyPreRisk(req.domain, req.prompt, policy.riskTolerance);

  let prompt = req.prompt;
  let regenerationCount = 0;
  // Split for VCO (spec 36): baseline is the one call the app would have made
  // anyway; governance is every extra call TripWire caused.
  let baselineTokens = ZERO_TOKENS;
  let governanceTokens = ZERO_TOKENS;
  let responseText = "";
  let decision;
  let verification;

  // Retrieve before generation so STANDARD/DEEP responses are actually grounded.
  // FAST remains a low-cost path with no retrieval.
  const initialEvidence = preRisk.mode === "FAST" ? [] : await retrieveEvidence(req.domain, prompt, provider);
  const optimizedPrompt = optimizeContext(prompt, initialEvidence);

  // Attachments only go on the initial call — regenerate retries are corrective text
  // feedback about the response already given, not a fresh look at the same file.
  const first = await provider.generate(optimizedPrompt, { attachments: req.attachments });
  responseText = first.text;
  let geminiSafetyHits = first.geminiSafetyHits ?? [];
  baselineTokens = addTokens(baselineTokens, first.tokens);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    verification = await runVerification(
      {
        domain: req.domain,
        requestId,
        originalPrompt: req.prompt,
        responseText,
        mode: preRisk.mode,
        regenerationCount,
        maxRetries: MAX_REGENERATE_RETRIES,
        expectedFormat: req.expectedFormat,
        initialEvidence,
        geminiSafetyHits,
      },
      provider
    );

    // Judge/CBG cost, accumulated per pass rather than read once — the loop
    // reassigns `verification` and would otherwise drop earlier passes' usage.
    governanceTokens = addTokens(governanceTokens, verification.governanceTokens);

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
    const retry = await provider.generate(optimizeContext(correctivePrompt, verification.evidence));
    responseText = retry.text;
    geminiSafetyHits = retry.geminiSafetyHits ?? [];
    // A retry exists only because governance rejected the first answer.
    governanceTokens = addTokens(governanceTokens, retry.tokens);
  }

  if (decision.action === "EDIT_CLARIFY") {
    const editPrompt = buildEditClarifyPrompt(req.prompt, responseText, decision.reasons);
    const edited = await provider.generate(editPrompt);
    responseText = edited.text;
    governanceTokens = addTokens(governanceTokens, edited.tokens);

    // The edit is model output like any other, so it gets checked like any other.
    // Previously it was returned unverified — an edit that introduced a leaked
    // secret or an unsafe phrasing would have gone straight to the user.
    //
    // One pass, no loop: this can only escalate. If the edited text scores worse
    // than EDIT_CLARIFY we adopt the stricter verdict; if it scores better we keep
    // EDIT_CLARIFY rather than promoting to ALLOW, because the reasons that
    // triggered the edit are still the honest account of what happened.
    const editVerification = await runVerification(
      {
        domain: req.domain,
        requestId,
        originalPrompt: req.prompt,
        responseText,
        mode: preRisk.mode,
        regenerationCount,
        maxRetries: MAX_REGENERATE_RETRIES,
        expectedFormat: req.expectedFormat,
        initialEvidence,
        geminiSafetyHits: edited.geminiSafetyHits ?? [],
      },
      provider
    );
    governanceTokens = addTokens(governanceTokens, editVerification.governanceTokens);

    const editDecision = evaluateRisk(editVerification.metrics, policy, editVerification.hardGate);
    if (ACTION_SEVERITY[editDecision.action] > ACTION_SEVERITY[decision.action]) {
      decision = {
        ...editDecision,
        reasons: [...editDecision.reasons, "escalated: the clarified response failed re-verification"],
      };
    }
    // Report the metrics of the text actually being delivered, not the pre-edit draft.
    verification = editVerification;
  }

  const finalOutcome = decision.action === "BLOCK" ? "blocked" : decision.action === "HUMAN_REVIEW" ? "pending_review" : "delivered";

  let humanReviewData = null;
  if (decision.action === "HUMAN_REVIEW") {
    humanReviewData = {
      risk: decision.riskLevel,
      reason: decision.reasons.join("; "),
      response: responseText,
      evidence: verification.evidence,
      metrics: verification.metrics,
    };
  }

  const latencyMs = Date.now() - startedAt;
  const vco = computeVCO(baselineTokens, governanceTokens);
  // Keep flat input/output as the totals so existing audit consumers still read
  // correctly; the baseline/governance split is additive.
  const tokens = {
    input: baselineTokens.input + governanceTokens.input,
    output: baselineTokens.output + governanceTokens.output,
    baseline: baselineTokens,
    governance: governanceTokens,
    vco,
  };

  const trace = await recordAuditTrace({
    requestId,
    policyId: policy.id,
    // Read from the provider rather than repeating the model name here, so the
    // trace can never claim a different model than the one that answered. A
    // provider that doesn't declare its model is recorded as unknown rather than
    // assumed to be Gemini — importing the Gemini module here would also drag
    // API-key validation into every consumer, including the test harness.
    model: provider.model ?? "unknown",
    promptMeta: { domain: req.domain, preRiskMode: preRisk.mode, preRiskReasons: preRisk.reasons },
    rawResponse: responseText,
    structuredRepresentation: verification.structured,
    metrics: verification.metrics,
    evidence: verification.evidence,
    judgeOutput: verification.judgeOutput,
    decision,
    regenerationCount,
    latencyMs,
    tokens,
    finalOutcome,
    humanReviewData,
  });

  const humanReviewId = trace.humanReview?.id;

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
    // Efficiency telemetry (spec 35/36/39) — computed and audited all along,
    // just never surfaced to the caller until now.
    latencyMs,
    tokens,
    vco,
    policyName: policy.domain,
  };
}
