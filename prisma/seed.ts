import { PrismaClient, type ChannelType } from "@prisma/client";

// Standalone scripts don't get Next.js's automatic .env loading, so load it
// ourselves using Node's built-in loader (no extra dependency).
try {
  process.loadEnvFile();
} catch {
  /* .env is optional if DATABASE_URL is already in the environment */
}

const prisma = new PrismaClient();

// Deterministic pseudo-random so re-seeds produce comparable data.
let seedState = 1337;
function rand() {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

const PRODUCTS = [
  { sku: "TEE-VINT-BLK-L", title: "Vintage Wash Cotton Tee — Black, Large", brand: "Northwind", price: 2800, cost: 900, cat: "Apparel" },
  { sku: "MUG-CER-NAVY", title: "Hand-Glazed Ceramic Mug — Navy 12oz", brand: "ClayWorks", price: 1800, cost: 600, cat: "Home" },
  { sku: "CANDLE-SOY-CEDAR", title: "Soy Wax Candle — Cedar & Sage 8oz", brand: "EmberLane", price: 2400, cost: 700, cat: "Home" },
  { sku: "NOTE-A5-DOT", title: "A5 Dot-Grid Hardcover Notebook", brand: "PaperTrail", price: 1600, cost: 450, cat: "Stationery" },
  { sku: "TOTE-CANVAS-NAT", title: "Heavyweight Canvas Tote — Natural", brand: "Northwind", price: 2200, cost: 650, cat: "Accessories" },
  { sku: "EARRING-BRASS-MOON", title: "Brass Crescent Moon Earrings", brand: "LunaForge", price: 3400, cost: 800, cat: "Jewelry" },
  { sku: "PRINT-A3-MTNS", title: "Mountain Range Giclée Print — A3", brand: "StudioFell", price: 3000, cost: 700, cat: "Art" },
  { sku: "SOAP-LAVENDER-3PK", title: "Cold-Process Lavender Soap — 3 Pack", brand: "EmberLane", price: 2000, cost: 550, cat: "Bath" },
  { sku: "BEANIE-WOOL-CHARC", title: "Merino Wool Ribbed Beanie — Charcoal", brand: "Northwind", price: 2600, cost: 800, cat: "Apparel" },
  { sku: "PLANTER-CONC-SM", title: "Concrete Planter — Small Hex", brand: "ClayWorks", price: 1900, cost: 500, cat: "Home" },
  { sku: "STICKER-PACK-RETRO", title: "Retro Vinyl Sticker Pack — 10ct", brand: "PaperTrail", price: 1200, cost: 250, cat: "Stationery" },
  { sku: "SCARF-SILK-FLORAL", title: "Silk Scarf — Wildflower Print", brand: "LunaForge", price: 4200, cost: 1200, cat: "Accessories" },
];

const IMG = (seed: string) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/400`;

async function main() {
  console.log("Seeding OpenClaw demo data…");

  // Reset (idempotent-ish for a demo DB).
  await prisma.syncLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.listingTemplate.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.user.deleteMany();
  await prisma.account.deleteMany();

  const account = await prisma.account.create({
    data: {
      name: "Driftwood Goods Co.",
      users: { create: { email: "owner@driftwoodgoods.test", name: "Sam Rivera", role: "OWNER" } },
    },
  });

  const main = await prisma.warehouse.create({
    data: { accountId: account.id, name: "Main Warehouse", code: "MAIN", city: "Portland", region: "OR", country: "US", isDefault: true },
  });
  const overflow = await prisma.warehouse.create({
    data: { accountId: account.id, name: "Overflow Storage", code: "OVF", city: "Reno", region: "NV", country: "US" },
  });

  // Channels — the three we actively sell on are CONNECTED, others available.
  const channelDefs: { type: ChannelType; name: string; status: "CONNECTED" | "DISCONNECTED"; markup: number; shop?: string }[] = [
    { type: "EBAY", name: "eBay — US store", status: "CONNECTED", markup: 8 },
    { type: "ETSY", name: "Etsy — Driftwood Goods", status: "CONNECTED", markup: 5 },
    { type: "SHOPIFY", name: "Shopify — driftwoodgoods.com", status: "CONNECTED", markup: 0, shop: "driftwoodgoods.myshopify.com" },
    { type: "AMAZON", name: "Amazon — US", status: "DISCONNECTED", markup: 12 },
    { type: "WALMART", name: "Walmart Marketplace", status: "DISCONNECTED", markup: 10 },
  ];
  const channels = [];
  for (const def of channelDefs) {
    channels.push(
      await prisma.channel.create({
        data: {
          accountId: account.id,
          type: def.type,
          name: def.name,
          status: def.status,
          priceMarkupPct: def.markup,
          shopDomain: def.shop,
          lastSyncAt: def.status === "CONNECTED" ? new Date() : null,
        },
      })
    );
  }
  const connected = channels.filter((c) => c.status === "CONNECTED");

  // Products + inventory + listings.
  const created = [];
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        accountId: account.id,
        sku: p.sku,
        title: p.title,
        description: `${p.title}. Crafted by ${p.brand}. A customer favorite in our ${p.cat.toLowerCase()} line.`,
        brand: p.brand,
        category: p.cat,
        priceCents: p.price,
        costCents: p.cost,
        upc: String(randInt(100000000000, 999999999999)),
        weightGrams: randInt(80, 1200),
        images: { create: [{ url: IMG(p.sku), position: 0 }, { url: IMG(p.sku + "-2"), position: 1 }] },
      },
    });

    // Stock split across two warehouses.
    const mainQty = randInt(0, 60);
    const ovfQty = randInt(0, 25);
    await prisma.inventoryItem.create({
      data: {
        productId: product.id,
        warehouseId: main.id,
        onHand: mainQty,
        reorderPoint: 8,
        reorderQty: 25,
        movements: { create: { delta: mainQty, reason: "PURCHASE_RECEIVED", note: "Initial stock" } },
      },
    });
    await prisma.inventoryItem.create({
      data: {
        productId: product.id,
        warehouseId: overflow.id,
        onHand: ovfQty,
        reorderPoint: 4,
        movements: { create: { delta: ovfQty, reason: "PURCHASE_RECEIVED", note: "Initial stock" } },
      },
    });

    // List on a random subset of connected channels.
    for (const ch of connected) {
      if (rand() < 0.25) continue; // not on every channel
      const markedUp = Math.round(p.price * (1 + ch.priceMarkupPct / 100));
      await prisma.listing.create({
        data: {
          productId: product.id,
          channelId: ch.id,
          status: "ACTIVE",
          externalId: `${ch.type.toLowerCase()}-${randInt(100000, 999999)}`,
          externalUrl: "https://example.com/listing",
          priceCents: markedUp,
          publishedQty: mainQty + ovfQty,
          publishedAt: new Date(),
          lastSyncAt: new Date(),
        },
      });
    }
    created.push(product);
  }

  // Orders spread across the last 30 days on connected channels.
  const buyers = [
    { name: "Jordan Lee", email: "jordan@example.com", city: "Austin", region: "TX", postal: "73301" },
    { name: "Priya Patel", email: "priya@example.com", city: "Seattle", region: "WA", postal: "98101" },
    { name: "Marco Rossi", email: "marco@example.com", city: "Chicago", region: "IL", postal: "60601" },
    { name: "Emma Schmidt", email: "emma@example.com", city: "Denver", region: "CO", postal: "80202" },
    { name: "Liu Wei", email: "liu@example.com", city: "San Jose", region: "CA", postal: "95101" },
  ];

  let orderCount = 0;
  for (let d = 0; d < 45; d++) {
    const channel = pick(connected);
    const buyer = pick(buyers);
    const placedAt = new Date(Date.now() - randInt(0, 30) * 86400000 - randInt(0, 86400000));
    const lineCount = randInt(1, 3);
    const items = [];
    let subtotal = 0;
    const usedSkus = new Set<string>();
    for (let i = 0; i < lineCount; i++) {
      const product = pick(created);
      if (usedSkus.has(product.sku)) continue;
      usedSkus.add(product.sku);
      const qty = randInt(1, 3);
      const price = Math.round(product.priceCents * (1 + channel.priceMarkupPct / 100));
      subtotal += price * qty;
      items.push({ sku: product.sku, title: product.title, quantity: qty, priceCents: price, productId: product.id });
    }
    const shipping = randInt(0, 800);
    const tax = Math.round(subtotal * 0.07);
    const total = subtotal + shipping + tax;
    const shipped = rand() < 0.55;

    await prisma.order.create({
      data: {
        accountId: account.id,
        channelId: channel.id,
        externalId: `${channel.type}-ORD-${10000 + d}`,
        orderNumber: `#${1000 + d}`,
        status: shipped ? "SHIPPED" : "AWAITING_FULFILLMENT",
        financialStatus: "PAID",
        subtotalCents: subtotal,
        shippingCents: shipping,
        taxCents: tax,
        totalCents: total,
        buyerName: buyer.name,
        buyerEmail: buyer.email,
        shipName: buyer.name,
        shipAddress1: `${randInt(100, 9999)} Market St`,
        shipCity: buyer.city,
        shipRegion: buyer.region,
        shipPostal: buyer.postal,
        shipCountry: "US",
        trackingNumber: shipped ? `1Z${randInt(100000000, 999999999)}` : null,
        carrier: shipped ? pick(["USPS", "UPS", "FedEx"]) : null,
        shippedAt: shipped ? placedAt : null,
        placedAt,
        items: { create: items },
      },
    });
    orderCount++;
  }

  // A couple of sync log entries for flavor.
  for (const ch of connected) {
    await prisma.syncLog.create({
      data: { channelId: ch.id, kind: "ORDER_IMPORT", status: "SUCCESS", message: `Imported orders from ${ch.name}` },
    });
  }

  console.log(`Done. ${created.length} products, ${channels.length} channels, ${orderCount} orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
