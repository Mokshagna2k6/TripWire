/**
 * Small provider interface so the Judge (and the main generation call) can be
 * backed by different LLMs later without touching pipeline code.
 */
export interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
}

export interface LLMProvider {
  generate(prompt: string, opts?: GenerateOptions): Promise<{ text: string; tokens: { input: number; output: number } }>;
  embed(text: string): Promise<number[]>;
}
