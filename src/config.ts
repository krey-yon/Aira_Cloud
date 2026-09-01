export const config = {
  apiKey:
    process.env.AI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    "",
  defaultModel: process.env.AI_MODEL ?? "gemini-3.7-flash",
} as const;

export function assertConfig() {
  if (!config.apiKey) {
    throw new Error("AI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is required");
  }
}
