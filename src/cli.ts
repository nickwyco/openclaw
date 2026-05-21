import { loadEnv } from "./agent/env";
import { runAgent } from "./agent/tempo";
import { systemPrompt, userPrompt } from "./agent/prompts";
import type { BrandBrief, Effort, Mode } from "./agent/types";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) =>
  useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
const bold = paint("1");
const dim = paint("2");
const cyan = paint("36");
const red = paint("31");

const EFFORTS: Effort[] = ["low", "medium", "high", "max"];
const VALUE_FLAGS = ["name", "site", "goal", "audience", "stage", "effort"];

function printHelp(): void {
  process.stdout.write(`${bold("Tempo")} — the AI Head of Growth

${bold("Usage")}
  tempo plan <brand description>      Generate a 90-day growth strategy
  tempo content <brand description>   Generate launch-ready marketing content

${bold("Options")}
  --name <name>        Brand name
  --site <url>         Brand website
  --goal <text>        Primary growth goal
  --audience <text>    Target audience / ICP
  --stage <text>       Company stage (e.g. pre-seed, Series A)
  --effort <level>     Reasoning effort: ${EFFORTS.join(" | ")}  (default: high)
  --no-stream          Wait for the full result instead of streaming it

${bold("Examples")}
  tempo plan "a B2B tool that turns SQL into live dashboards" --goal "300 paid teams"
  tempo content --name Tempo --site withtempo.ai --audience "seed-stage founders"

Requires ANTHROPIC_API_KEY in your environment or a .env file.
`);
}

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string>;
  noStream: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  let noStream = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--no-stream") {
      noStream = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (!VALUE_FLAGS.includes(key)) {
        throw new Error(`Unknown option: ${arg}`);
      }
      const value = args[++i];
      if (value === undefined) {
        throw new Error(`Missing value for --${key}`);
      }
      flags[key] = value;
      continue;
    }
    positional.push(arg);
  }

  return { positional, flags, noStream };
}

async function run(mode: Mode, args: string[]): Promise<void> {
  const { positional, flags, noStream } = parseArgs(args);

  const effort = (flags.effort ?? "high") as Effort;
  if (!EFFORTS.includes(effort)) {
    throw new Error(
      `Invalid --effort "${flags.effort}". Use one of: ${EFFORTS.join(", ")}`,
    );
  }

  const brief: BrandBrief = {
    name: flags.name,
    website: flags.site,
    description: positional.length > 0 ? positional.join(" ") : undefined,
    goal: flags.goal,
    audience: flags.audience,
    stage: flags.stage,
  };

  if (!brief.name && !brief.description) {
    throw new Error(
      "Describe the brand: pass a description as text, or use --name.",
    );
  }

  const label = mode === "content" ? "marketing content" : "90-day growth plan";
  process.stderr.write(
    `${cyan(bold("Tempo"))} ${dim(`is researching and building your ${label}…`)}\n`,
  );

  let researched = false;
  let answerStarted = false;

  await runAgent(systemPrompt(mode), userPrompt(mode, brief), {
    effort,
    onSearch: (query) => {
      researched = true;
      process.stderr.write(dim(`  researching  ${query}\n`));
    },
    onText: noStream
      ? undefined
      : (delta) => {
          if (!answerStarted) {
            if (researched) process.stderr.write("\n");
            answerStarted = true;
          }
          process.stdout.write(delta);
        },
  }).then((full) => {
    if (noStream) {
      process.stdout.write(`\n${full}\n`);
    } else {
      process.stdout.write("\n");
    }
  });
}

async function main(): Promise<void> {
  loadEnv();
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command !== "plan" && command !== "content") {
    process.stderr.write(red(`Unknown command: ${command}\n\n`));
    printHelp();
    process.exitCode = 1;
    return;
  }

  await run(command, argv.slice(1));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(red(`\nError: ${message}\n`));
  process.exitCode = 1;
});
