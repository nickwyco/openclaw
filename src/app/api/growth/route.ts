import type { NextRequest } from "next/server";
import { runAgent } from "@/agent/tempo";
import { systemPrompt, userPrompt } from "@/agent/prompts";
import type { BrandBrief, Effort, Mode } from "@/agent/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const EFFORTS: Effort[] = ["low", "medium", "high", "max"];

interface GrowthRequest {
  mode?: string;
  name?: string;
  website?: string;
  description?: string;
  goal?: string;
  audience?: string;
  stage?: string;
  effort?: string;
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: GrowthRequest;
  try {
    body = (await req.json()) as GrowthRequest;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const mode: Mode = body.mode === "content" ? "content" : "plan";

  const effort = (body.effort ?? "high") as Effort;
  if (!EFFORTS.includes(effort)) {
    return badRequest(`effort must be one of: ${EFFORTS.join(", ")}`);
  }

  const brief: BrandBrief = {
    name: body.name,
    website: body.website,
    description: body.description,
    goal: body.goal,
    audience: body.audience,
    stage: body.stage,
  };

  if (!brief.name && !brief.description) {
    return badRequest("Provide at least a brand `name` or `description`.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await runAgent(systemPrompt(mode), userPrompt(mode, brief), {
          effort,
          onText: (delta) => controller.enqueue(encoder.encode(delta)),
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        controller.enqueue(encoder.encode(`\n\n[Tempo error] ${message}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
