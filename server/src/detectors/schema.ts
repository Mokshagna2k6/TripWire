/**
 * Basic schema-compliance check. If the caller supplied `expectedFormat: "json"`
 * (optionally with `requiredFields`), verify the response parses and has them.
 * This feeds both the fast-detector pass and the SC component of SchemaX.
 */
export interface SchemaCheckResult {
  applicable: boolean;
  valid: boolean;
  errors: string[];
}

export function checkSchema(
  text: string,
  expected?: { format?: "json"; requiredFields?: string[] }
): SchemaCheckResult {
  if (!expected?.format) return { applicable: false, valid: true, errors: [] };

  const errors: string[] = [];
  let parsed: unknown;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return { applicable: true, valid: false, errors: ["response is not valid JSON"] };
  }

  for (const field of expected.requiredFields ?? []) {
    if (typeof parsed !== "object" || parsed === null || !(field in (parsed as object))) {
      errors.push(`missing required field: ${field}`);
    }
  }

  return { applicable: true, valid: errors.length === 0, errors };
}
