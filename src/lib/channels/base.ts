import type { ChannelType } from "@prisma/client";
import { NotConnectedError, type ChannelWithConfig } from "./types";

export interface HttpOptions {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  // When true, send/parse form-urlencoded instead of JSON (OAuth token endpoints).
  form?: boolean;
}

export class ChannelApiError extends Error {
  constructor(
    public status: number,
    public url: string,
    public responseBody: string
  ) {
    super(`Channel API ${status} for ${url}: ${responseBody.slice(0, 500)}`);
    this.name = "ChannelApiError";
  }
}

// Shared behavior for every adapter: a thin fetch wrapper with sane error
// handling, query-string building, and JSON/form encoding.
export abstract class BaseAdapter {
  abstract readonly type: ChannelType;
  abstract isConfigured(): boolean;

  protected requireToken(channel: ChannelWithConfig): string {
    if (!channel.accessToken) throw new NotConnectedError(this.type);
    return channel.accessToken;
  }

  protected buildUrl(base: string, path: string, query?: HttpOptions["query"]): string {
    const url = new URL(path.startsWith("http") ? path : `${base}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  protected async http<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    let body: string | undefined;

    if (opts.body !== undefined) {
      if (opts.form) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        body = new URLSearchParams(opts.body as Record<string, string>).toString();
      } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(opts.body);
      }
    }

    const res = await fetch(url, { method: opts.method ?? "GET", headers, body });
    const text = await res.text();

    if (!res.ok) {
      throw new ChannelApiError(res.status, url, text);
    }

    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
}
