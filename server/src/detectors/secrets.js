/** Detects leaked API keys / credentials / tokens in text. Regex-based, real-world key shapes. */
const PATTERNS = {
  google_api_key: /AIza[0-9A-Za-z_-]{35}/g,
  aws_access_key: /AKIA[0-9A-Z]{16}/g,
  openai_key: /sk-[A-Za-z0-9]{20,}/g,
  generic_bearer_token: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}=*/g,
  private_key_block: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g,
  slack_token: /xox[baprs]-[A-Za-z0-9-]{10,}/g,
};

export function detectSecrets(text) {
  const matches = [];
  for (const [type, pattern] of Object.entries(PATTERNS)) {
    const found = text.match(pattern);
    if (found) {
      for (const value of found) matches.push({ type, value });
    }
  }
  return matches;
}
