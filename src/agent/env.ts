import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal .env loader for the CLI. Next.js loads .env on its own, but the
 * standalone CLI process does not, so we read it here. Existing process.env
 * values always win.
 */
export function loadEnv(file = ".env"): void {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
