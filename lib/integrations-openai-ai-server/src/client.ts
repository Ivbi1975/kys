import OpenAI from "openai";

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

export function assertOpenAiConfigured(): void {
  if (!isOpenAiConfigured()) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY must be set to use AI features.",
    );
  }
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "missing-openai-api-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "http://127.0.0.1/__missing_openai_base_url",
});
