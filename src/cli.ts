import { loadEnv } from "./agent/env";
import { generateCreatives, research } from "./agent/tempo";
import type {
  CreativeBatch,
  Effort,
  FormatMix,
  ProductBrief,
} from "./agent/types";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) =>
  useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
const bold = paint("1");
const dim = paint("2");
const cyan = paint("36");
const red = paint("31");

const EFFORTS: Effort[] = ["low", "medium", "high", "max"];
const FORMATS: FormatMix[] = ["static", "video", "mixed"];
const VALUE_FLAGS = [
  "name",
  "brand",
  "url",
  "price",
  "audience",
  "count",
  "format",
  "effort",
];
const MAX_COUNT = 16;

function printHelp(): void {
  process.stdout.write(`${bold("Tempo")} — the agentic growth engine for ecommerce

${bold("Usage")}
  tempo ads <product description>     Generate this week's ad creative batch

${bold("Options")}
  --name <name>        Product name
  --brand <brand>      Brand name
  --url <url>          Product or store URL
  --price <price>      Product price (e.g. $49)
  --audience <text>    Target customer, if you already know it
  --count <n>          Number of ad concepts to generate (1-${MAX_COUNT}, default 8)
  --format <type>      Creative format: ${FORMATS.join(" | ")}  (default mixed)
  --effort <level>     Reasoning effort: ${EFFORTS.join(" | ")}  (default high)

${bold("Examples")}
  tempo ads "a $39 ceramic non-stick pan for home cooks" --count 10
  tempo ads --name "Trailhead Boots" --url example.com --format static

Requires ANTHROPIC_API_KEY in your environment or a .env file.
`);
}

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string>;
}

function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
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

  return { positional, flags };
}

function renderBatch(batch: CreativeBatch): void {
  const w = process.stdout;
  const s = batch.weekly_strategy;

  w.write(
    `\n${cyan(bold("TEMPO"))}  ${dim("·")}  ${bold(`weekly creative batch — ${batch.brand}`)}\n`,
  );

  w.write(`\n${bold("STRATEGY")}\n`);
  w.write(`  ${dim("Theme")}      ${s.theme}\n`);
  w.write(`  ${s.rationale}\n`);
  w.write(`  ${dim("Angles")}     ${s.angles_to_test.join("  ·  ")}\n`);
  w.write(`  ${dim("Personas")}   ${s.personas_to_test.join("  ·  ")}\n`);
  w.write(`  ${dim("Format")}     ${s.format_mix}\n`);

  for (const ad of batch.ads) {
    w.write(
      `\n${cyan(bold(ad.id))}  ${dim("·")}  ${ad.format}  ${dim("·")}  ${ad.persona}\n`,
    );
    w.write(`  ${dim("Angle")}     ${ad.angle}\n`);
    w.write(`  ${dim("Hook")}      ${bold(ad.hook)}\n`);
    w.write(`  ${dim("Primary")}   ${ad.primary_text}\n`);
    w.write(`  ${dim("Headline")}  ${ad.headline}\n`);
    w.write(`  ${dim("CTA")}       [${ad.cta}]\n`);
    w.write(`  ${dim("Offer")}     ${ad.offer}\n`);
    w.write(`  ${dim("Visual")}    ${ad.visual_direction}\n`);
    w.write(`  ${dim("Why")}       ${dim("insight —")} ${ad.reasoning.product_insight}\n`);
    w.write(`            ${dim("angle —")} ${ad.reasoning.customer_angle}\n`);
    w.write(`            ${dim("test —")} ${ad.reasoning.performance_hypothesis}\n`);
  }
  w.write("\n");
}

async function runAds(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args);

  const effort = (flags.effort ?? "high") as Effort;
  if (!EFFORTS.includes(effort)) {
    throw new Error(
      `Invalid --effort "${flags.effort}". Use one of: ${EFFORTS.join(", ")}`,
    );
  }

  const formatMix = (flags.format ?? "mixed") as FormatMix;
  if (!FORMATS.includes(formatMix)) {
    throw new Error(
      `Invalid --format "${flags.format}". Use one of: ${FORMATS.join(", ")}`,
    );
  }

  let count = 8;
  if (flags.count !== undefined) {
    count = Number.parseInt(flags.count, 10);
    if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
      throw new Error(`--count must be an integer between 1 and ${MAX_COUNT}.`);
    }
  }

  const brief: ProductBrief = {
    name: flags.name,
    brand: flags.brand,
    url: flags.url,
    description: positional.length > 0 ? positional.join(" ") : undefined,
    price: flags.price,
    audience: flags.audience,
  };

  if (!brief.name && !brief.description && !brief.url) {
    throw new Error(
      "Describe the product: pass a description as text, or use --name or --url.",
    );
  }

  process.stderr.write(
    `${cyan(bold("Tempo"))} ${dim("is researching your product…")}\n`,
  );
  const researchBrief = await research(brief, {
    effort,
    onSearch: (query) => process.stderr.write(dim(`  researching  ${query}\n`)),
  });

  process.stderr.write(
    dim(`\nWriting ${count} ad concept${count === 1 ? "" : "s"}…\n`),
  );
  const batch = await generateCreatives(brief, researchBrief, {
    effort,
    count,
    formatMix,
  });

  renderBatch(batch);
}

async function main(): Promise<void> {
  loadEnv();
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command !== "ads") {
    process.stderr.write(red(`Unknown command: ${command}\n\n`));
    printHelp();
    process.exitCode = 1;
    return;
  }

  await runAds(argv.slice(1));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(red(`\nError: ${message}\n`));
  process.exitCode = 1;
});
