import { computeSchemaX } from "./schemaX.js";
import { computeUIS } from "./uis.js";
import { computeCEG, estimateConfidence } from "./ceg.js";
import { computeErrorDensity } from "./errorDensity.js";
import { computeCUR } from "./cur.js";
import { computeRO } from "./ro.js";
import { computeRRE } from "./rre.js";
import { computePLS } from "./pls.js";
import { computeSHS } from "./shs.js";
import { computeSAS } from "./sas.js";

/** Runs the core metric set (parallel where independent — all are pure/sync here except embeddings, computed upstream). */
export function computeMetrics(input) {
  const schemaX = computeSchemaX(input.structured, input.evidence, input.fastDetectors.schema);
  const confidence = estimateConfidence(input.responseText);

  return {
    schemaX,
    uis: computeUIS(input.structured, input.evidence),
    ceg: computeCEG(confidence, schemaX.evidenceSupport),
    errorDensity: computeErrorDensity(input.responseText),
    cur: computeCUR(input.responseText, input.evidence),
    ro: computeRO(input.regenerationCount, input.maxRetries),
    rre: computeRRE(input.structured.keySpans, input.evidence),
    pls: computePLS(input.fastDetectors.pii, input.fastDetectors.secrets),
    shs: computeSHS(input.fastDetectors.safety, input.judgeOutput?.safetySeverity),
    sas:
      input.responseEmbedding && input.evidenceEmbeddings
        ? computeSAS(input.responseEmbedding, input.evidenceEmbeddings)
        : 0,
    cbg: null,
  };
}
