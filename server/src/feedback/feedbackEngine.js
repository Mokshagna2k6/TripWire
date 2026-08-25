import { prisma } from "../db.js";

/**
 * DELIBERATE REVERSED CONVENTION (explicit product requirement, do not "fix"):
 *   system BLOCK + human ALLOW  = false_negative  (system missed that it was actually fine? No —
 *     per spec this is intentionally reversed from the textbook "flag=positive" convention.)
 *   system ALLOW + human BLOCK  = false_positive
 * "Flagged" here means any system action other than ALLOW (BLOCK, HUMAN_REVIEW, REGENERATE,
 * EDIT_CLARIFY all represent the system intervening rather than passing content through untouched).
 */
export function classifyFeedback(systemAction, humanDecision) {
  const systemFlagged = systemAction !== "ALLOW";
  const humanBlocked = humanDecision === "BLOCK";

  if (systemFlagged && !humanBlocked) return "false_negative";
  if (!systemFlagged && humanBlocked) return "false_positive";
  if (systemFlagged && humanBlocked) return "true_positive";
  return "true_negative";
}

export async function recordFeedback(auditTraceId, systemAction, humanDecision) {
  const classification = classifyFeedback(systemAction, humanDecision);
  return prisma.feedbackRecord.create({
    data: { auditTraceId, systemAction, humanDecision, classification },
  });
}

/** Aggregate precision/recall/FPR/FNR/override-rate using the reversed convention above. */
export function computeFeedbackStats(records) {
  const truePositive = records.filter((r) => r.classification === "true_positive").length;
  const trueNegative = records.filter((r) => r.classification === "true_negative").length;
  const falsePositive = records.filter((r) => r.classification === "false_positive").length;
  const falseNegative = records.filter((r) => r.classification === "false_negative").length;
  const total = records.length;

  const safeDiv = (n, d) => (d === 0 ? 0 : n / d);

  return {
    total,
    truePositive,
    trueNegative,
    falsePositive,
    falseNegative,
    precision: safeDiv(truePositive, truePositive + falsePositive),
    recall: safeDiv(truePositive, truePositive + falseNegative),
    falsePositiveRate: safeDiv(falsePositive, falsePositive + trueNegative),
    falseNegativeRate: safeDiv(falseNegative, falseNegative + truePositive),
    overrideRate: safeDiv(falsePositive + falseNegative, total),
  };
}
