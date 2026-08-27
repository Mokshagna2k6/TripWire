const ACTION_SEVERITY = {
  ALLOW: 0,
  EDIT_CLARIFY: 1,
  REGENERATE: 2,
  HUMAN_REVIEW: 3,
  BLOCK: 4,
};

const ACTION_RISK_LEVEL = {
  ALLOW: "low",
  EDIT_CLARIFY: "medium",
  REGENERATE: "medium",
  HUMAN_REVIEW: "high",
  BLOCK: "critical",
};

function metricValue(metrics, name) {
  switch (name) {
    case "pls":
      return metrics.pls;
    case "shs":
      return metrics.shs;
    case "uis":
      return metrics.uis;
    case "ceg":
      return metrics.ceg;
    case "errorDensity":
      return metrics.errorDensity;
    case "cur":
      return metrics.cur;
    case "ro":
      return metrics.ro;
    case "rre":
      return metrics.rre;
    case "sas":
      return metrics.sas;
    case "cbg":
      return metrics.cbg ?? undefined;
    case "hallucinationRisk":
      return metrics.hallucinationRisk;
    case "schemaX":
      return metrics.schemaX.score;
    default:
      return undefined;
  }
}

function compare(value, operator, threshold) {
  switch (operator) {
    case ">=":
      return value >= threshold;
    case ">":
      return value > threshold;
    case "<=":
      return value <= threshold;
    case "<":
      return value < threshold;
  }
}

/** Downgrade an action to the nearest one the policy permits, if it isn't in allowedActions. */
function enforceAllowedActions(action, allowed) {
  if (allowed.includes(action)) return action;
  // fall back to the most conservative permitted action at or above this severity
  const candidates = allowed
    .filter((a) => ACTION_SEVERITY[a] >= ACTION_SEVERITY[action])
    .sort((a, b) => ACTION_SEVERITY[a] - ACTION_SEVERITY[b]);
  return candidates[0] ?? "HUMAN_REVIEW";
}

/**
 * Combines fast-detector hard gates, policy hard gates, policy threshold rules,
 * and (if present) judge output already folded into `metrics.shs`, into a single
 * risk_level + action decision. Hard gates always win and skip further scoring.
 */
export function evaluateRisk(metrics, policy, hardGate) {
  if (hardGate.triggered) {
    return { riskLevel: "critical", action: "BLOCK", reasons: hardGate.reasons };
  }

  const reasons = [];

  for (const [metric, threshold] of Object.entries(policy.hardGates)) {
    const value = metricValue(metrics, metric);
    if (value !== undefined && value >= threshold) {
      reasons.push(`policy hard gate: ${metric}=${value.toFixed(2)} >= ${threshold}`);
    }
  }
  if (reasons.length > 0) {
    return { riskLevel: "critical", action: "BLOCK", reasons };
  }

  let bestAction = "ALLOW";
  for (const rule of policy.thresholds) {
    const value = metricValue(metrics, rule.metric);
    if (value === undefined) continue;
    if (compare(value, rule.operator, rule.value)) {
      reasons.push(`${rule.metric}=${value.toFixed(2)} ${rule.operator} ${rule.value} -> ${rule.action}`);
      if (ACTION_SEVERITY[rule.action] > ACTION_SEVERITY[bestAction]) bestAction = rule.action;
    }
  }

  const finalAction = enforceAllowedActions(bestAction, policy.allowedActions);
  if (finalAction === "ALLOW" && reasons.length === 0) reasons.push("all metrics within policy thresholds");

  return { riskLevel: ACTION_RISK_LEVEL[finalAction], action: finalAction, reasons };
}
