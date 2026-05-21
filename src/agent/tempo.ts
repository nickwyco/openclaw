import Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL } from "./client";
import type { AgentRunOptions } from "./types";

// Server-side web_search runs its own loop and can yield `pause_turn`; we
// resume up to this many times before giving up.
const MAX_CONTINUATIONS = 8;

/**
 * Runs the Tempo agent: a streaming Claude call with adaptive thinking and the
 * server-side web_search tool, so Claude researches the brand before writing.
 * Returns the full text response; callbacks expose incremental progress.
 */
export async function runAgent(
  system: string,
  prompt: string,
  options: AgentRunOptions = {},
): Promise<string> {
  const client = getClient();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];
  let answer = "";

  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: options.maxTokens ?? 48000,
      system,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: options.effort ?? "high" },
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages,
    });

    for await (const event of stream) {
      if (event.type !== "content_block_delta") continue;
      if (event.delta.type === "thinking_delta") {
        options.onThinking?.(event.delta.thinking);
      } else if (event.delta.type === "text_delta") {
        answer += event.delta.text;
        options.onText?.(event.delta.text);
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

  return answer.trim();
}
