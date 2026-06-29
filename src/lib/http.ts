import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Consistent JSON helpers + error envelope for the API routes.
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function badRequest(message: string, detail?: unknown) {
  return NextResponse.json({ error: message, detail }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

// Wrap a route handler so thrown ZodErrors become 400s and everything else a 500.
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((err) => {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation failed", detail: err.flatten() }, { status: 400 });
    }
    console.error("[api] error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  });
}
