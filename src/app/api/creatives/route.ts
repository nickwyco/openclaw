import type { NextRequest } from "next/server";
import { generateCreatives, research } from "@/agent/tempo";
import type { Effort, FormatMix, ProductBrief } from "@/agent/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const EFFORTS: Effort[] = ["low", "medium", "high", "max"];
const FORMATS: FormatMix[] = ["static", "video", "mixed"];
const MAX_COUNT = 16;

interface CreativeRequest {
  name?: string;
  brand?: string;
  url?: string;
  description?: string;
  price?: string;
  audience?: string;
  count?: number;
  format?: string;
  effort?: string;
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: CreativeRequest;
  try {
    body = (await req.json()) as CreativeRequest;
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  const effort = (body.effort ?? "high") as Effort;
  if (!EFFORTS.includes(effort)) {
    return badRequest(`effort must be one of: ${EFFORTS.join(", ")}`);
  }

  const formatMix = (body.format ?? "mixed") as FormatMix;
  if (!FORMATS.includes(formatMix)) {
    return badRequest(`format must be one of: ${FORMATS.join(", ")}`);
  }

  const count = body.count ?? 8;
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return badRequest(`count must be an integer between 1 and ${MAX_COUNT}.`);
  }

  const brief: ProductBrief = {
    name: body.name,
    brand: body.brand,
    url: body.url,
    description: body.description,
    price: body.price,
    audience: body.audience,
  };

  if (!brief.name && !brief.description && !brief.url) {
    return badRequest("Provide at least a product `name`, `description`, or `url`.");
  }

  try {
    const researchBrief = await research(brief, { effort });
    const batch = await generateCreatives(brief, researchBrief, {
      effort,
      count,
      formatMix,
    });
    return Response.json(batch);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 502 });
  }
}
