import Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL } from "./client";
import { briefToPrompt, CREATIVE_SYSTEM, RESEARCH_SYSTEM } from "./prompts";
import { CREATIVE_BATCH_SCHEMA } from "./schema";
import type {
  CreativeBatch,
  GenerateOptions,
  ProductBrief,
  ResearchOptions,
} from "./types";

// Server-side web_search runs its own loop and can yield `pause_turn`; we
// resume up to this many times before giving up.
const MAX_CONTINUATIONS = 8;

/**
 * Step 1 — research. A streaming Claude call with the server-side web_search
 * tool that studies the product, its buyers, and its competitors, and returns
 * a dense research brief used as the input to creative generation.
 */
export async function research(
  brief: ProductBrief,
  options: ResearchOptions = {},
): Promise<string> {
  const client = getClient();
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Product brief:\n\n${briefToPrompt(brief)}\n\nResearch this product, its buyers, and its competitive landscape, then write the research brief.`,
    },
  ];
  let text = "";

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: RESEARCH_SYSTEM,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: options.effort ?? "high" },
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages,
    });

    for await (const event of stream) {
      if (event.type !== "content_block_delta") continue;
      if (event.delta.type === "thinking_delta") {
        options.onThinking?.();
      } else if (event.delta.type === "text_delta") {
        text += event.delta.text;
      }
    }

    const message = await stream.finalMessage();
    for (const block of message.content) {
      if (block.type === "server_tool_use" && block.name === "web_search") {
        const query = (block.input as { query?: string }).query;
        if (query) options.onSearch?.(query);
      }
    }

    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    break;
  }

  return text.trim();
}

/**
 * Step 2 — creative generation. A streaming Claude call constrained to the
 * creative-batch JSON schema (structured outputs). Returns the parsed batch:
 * a weekly strategy plus the individual ad concepts.
 */
export async function generateCreatives(
  brief: ProductBrief,
  researchBrief: string,
  options: GenerateOptions,
): Promise<CreativeBatch> {
  const client = getClient();

  const formatLine =
    options.formatMix === "mixed"
      ? "Use a deliberate mix of static and light-motion video formats."
      : `Every ad in this batch must use the ${options.formatMix} format.`;

  const prompt = `Product brief:\n\n${briefToPrompt(brief)}\n\nResearch brief:\n\n${researchBrief}\n\nGenerate this week's creative batch with exactly ${options.count} distinct ad concepts. ${formatLine}`;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    system: CREATIVE_SYSTEM,
    thinking: { type: "adaptive", display: "summarized" },
    output_config: {
      effort: options.effort ?? "high",
      format: { type: "json_schema", schema: CREATIVE_BATCH_SCHEMA },
    },
    messages: [{ role: "user", content: prompt }],
  });

  let text = "";
  for await (const event of stream) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta.type === "thinking_delta") {
      options.onThinking?.();
    } else if (event.delta.type === "text_delta") {
      text += event.delta.text;
    }
  }

  const message = await stream.finalMessage();
  if (message.stop_reason === "max_tokens") {
    throw new Error(
      "Creative generation hit the token limit — try a lower --count.",
    );
  }

  try {
    return JSON.parse(text) as CreativeBatch;
  } catch {
    throw new Error("Tempo returned output that could not be parsed as JSON.");
  }
}
