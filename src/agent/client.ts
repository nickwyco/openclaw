import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-4-7";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your environment or a .env file.",
    );
  }
  if (!client) {
    client = new Anthropic();
  }
  return client;
}
