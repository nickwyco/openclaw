// Standalone background worker. Run with `npm run sync:worker`.
//
// In production you would drive this with a real queue/cron (BullMQ, Temporal,
// a platform scheduler…). Here it's a simple interval loop that:
//   1. refreshes channel tokens that are near expiry
//   2. imports new orders from every connected channel
//   3. reconciles inventory for products that changed recently

// Load .env BEFORE importing anything that reads DATABASE_URL. Next.js loads
// env automatically for the app, but this process runs on its own, so we use
// Node's built-in loader and dynamic imports to guarantee ordering.
try {
  process.loadEnvFile();
} catch {
  /* .env optional if DATABASE_URL is already set */
}

const INTERVAL_MS = Number(process.env.SYNC_INTERVAL_MS ?? 5 * 60 * 1000);

async function tick() {
  const { prisma } = await import("@/lib/prisma");
  const { ensureFreshToken } = await import("@/lib/sync/oauth");
  const { importOrders, syncInventoryForProduct } = await import("@/lib/sync/engine");

  const started = new Date();
  console.log(`[worker] tick @ ${started.toISOString()}`);

  const channels = await prisma.channel.findMany({ where: { status: "CONNECTED", autoSync: true } });
  for (const channel of channels) {
    await ensureFreshToken(channel.id);
    const res = await importOrders(channel.id);
    console.log(`[worker] orders ${channel.name}: ${res.message}`);
  }

  // Re-push inventory for products touched since the last tick.
  const recent = await prisma.product.findMany({
    where: { updatedAt: { gte: new Date(started.getTime() - INTERVAL_MS) } },
    select: { id: true, sku: true },
  });
  for (const p of recent) {
    const outcomes = await syncInventoryForProduct(p.id);
    if (outcomes.length) console.log(`[worker] inventory ${p.sku}: ${outcomes.map((o) => o.message).join("; ")}`);
  }
}

async function main() {
  console.log(`[worker] starting, interval ${INTERVAL_MS}ms`);
  // Run once immediately, then on an interval.
  await tick().catch((e) => console.error("[worker] tick error", e));
  setInterval(() => {
    tick().catch((e) => console.error("[worker] tick error", e));
  }, INTERVAL_MS);
}

main().catch((e) => {
  console.error("[worker] fatal", e);
  process.exit(1);
});
