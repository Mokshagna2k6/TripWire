/**
 * Basic schema-compliance check. If the caller supplied `expectedFormat: "json"`
 * (optionally with `requiredFields`), verify the response parses and has them.
 * This feeds both the fast-detector pass and the SC component of SchemaX.
 */
export function checkSchema(text, expected) {
  if (!expected?.format) return { applicable: false, valid: true, errors: [] };

  const errors = [];
  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return { applicable: true, valid: false, errors: ["response is not valid JSON"] };
  }

  for (const field of expected.requiredFields ?? []) {
    if (typeof parsed !== "object" || parsed === null || !(field in parsed)) {
      errors.push(`missing required field: ${field}`);
    }
  }

  return { applicable: true, valid: errors.length === 0, errors };
}
