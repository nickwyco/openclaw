import type { SyncKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { availableForProduct } from "@/lib/inventory";
import { applyMarkup } from "@/lib/money";
import { getAdapter } from "@/lib/channels/registry";
import {
  NotConfiguredError,
  NotConnectedError,
  type ChannelWithConfig,
  type ProductForListing,
  type PublishContext,
} from "@/lib/channels/types";

// ---------------------------------------------------------------------------
// The sync engine is the bridge between our catalog/inventory and the
// marketplace adapters. Every operation records a SyncLog so the UI can show
// exactly what happened, and degrades safely when credentials are missing.
// ---------------------------------------------------------------------------

async function log(
  channelId: string | null,
  kind: SyncKind,
  status: "SUCCESS" | "FAILURE" | "SKIPPED",
  message: string,
  detail?: unknown
) {
  await prisma.syncLog.create({
    data: { channelId, kind, status, message, detail: detail ? (detail as object) : undefined },
  });
}

// Resolve the values pushed to a channel: title, description, marked-up price,
// and total available quantity across all warehouses.
async function buildContext(
  channel: ChannelWithConfig,
  product: ProductForListing,
  listing: { id: string } & Partial<{ priceCents: number | null; title: string | null; description: string | null }>
): Promise<PublishContext> {
  const qty = await availableForProduct(product.id);
  const basePrice = listing.priceCents ?? product.priceCents;
  return {
    channel,
    product,
    listing: listing as PublishContext["listing"],
    priceCents: applyMarkup(basePrice, channel.priceMarkupPct),
    quantity: qty,
    title: listing.title ?? product.title,
    description: listing.description ?? product.description ?? product.title,
  };
}

export interface SyncOutcome {
  ok: boolean;
  skipped?: boolean;
  message: string;
}

// Publish (or re-publish) a single listing to its channel.
export async function publishListing(listingId: string): Promise<SyncOutcome> {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { channel: true, product: { include: { images: true } } },
  });
  if (!listing) return { ok: false, message: "Listing not found" };

  const adapter = getAdapter(listing.channel.type);
  try {
    if (!adapter.isConfigured()) throw new NotConfiguredError(listing.channel.type);

    await prisma.listing.update({ where: { id: listingId }, data: { status: "PUBLISHING" } });
    const ctx = await buildContext(listing.channel, listing.product, listing);

    const result = listing.externalId
      ? await adapter.updateListing(ctx)
      : await adapter.publishListing(ctx);

    await prisma.listing.update({
      where: { id: listingId },
      data: {
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        status: "ACTIVE",
        publishedQty: ctx.quantity,
        publishedAt: listing.publishedAt ?? new Date(),
        lastSyncAt: new Date(),
        lastError: null,
      },
    });
    await log(listing.channelId, "LISTING_PUBLISH", "SUCCESS", `Published ${listing.product.sku} to ${listing.channel.name}`, result);
    return { ok: true, message: `Listed ${listing.product.sku} on ${listing.channel.name}` };
  } catch (err) {
    return handleListingError(err, listing.id, listing.channelId, listing.channel.type, "LISTING_PUBLISH");
  }
}

// Push the current available quantity for a product to every ACTIVE listing.
// This is the heart of multi-channel oversell protection.
export async function syncInventoryForProduct(productId: string): Promise<SyncOutcome[]> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { listings: { include: { channel: true } } },
  });
  if (!product) return [{ ok: false, message: "Product not found" }];

  const qty = await availableForProduct(productId);
  const outcomes: SyncOutcome[] = [];

  for (const listing of product.listings) {
    if (listing.status !== "ACTIVE" || !listing.externalId) continue;
    if (!listing.channel.autoSync) {
      outcomes.push({ ok: true, skipped: true, message: `${listing.channel.name}: autoSync off` });
      continue;
    }

    const adapter = getAdapter(listing.channel.type);
    try {
      if (!adapter.isConfigured()) throw new NotConfiguredError(listing.channel.type);
      await adapter.updateInventory(listing.channel, { ...listing, product } as never, qty);
      await prisma.listing.update({
        where: { id: listing.id },
        data: { publishedQty: qty, lastSyncAt: new Date(), lastError: null },
      });
      await log(listing.channelId, "INVENTORY_PUSH", "SUCCESS", `${product.sku} → ${qty} on ${listing.channel.name}`);
      outcomes.push({ ok: true, message: `${listing.channel.name}: set to ${qty}` });
    } catch (err) {
      const o = await handleListingError(err, listing.id, listing.channelId, listing.channel.type, "INVENTORY_PUSH");
      outcomes.push(o);
    }
  }
  return outcomes;
}

// Pull new orders from a channel, upsert them, and reserve inventory for any
// matching SKUs so available stock drops immediately.
export async function importOrders(channelId: string): Promise<SyncOutcome> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) return { ok: false, message: "Channel not found" };

  const adapter = getAdapter(channel.type);
  try {
    if (!adapter.isConfigured()) throw new NotConfiguredError(channel.type);
    const since = channel.lastSyncAt ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    const orders = await adapter.fetchOrders(channel, since);

    let imported = 0;
    for (const o of orders) {
      const existing = await prisma.order.findUnique({
        where: { channelId_externalId: { channelId, externalId: o.externalId } },
      });
      if (existing) continue;

      // Match line items back to catalog products by SKU.
      const skus = o.items.map((i) => i.sku);
      const products = await prisma.product.findMany({
        where: { accountId: channel.accountId, sku: { in: skus } },
      });
      const bySku = new Map(products.map((p) => [p.sku, p]));

      await prisma.order.create({
        data: {
          accountId: channel.accountId,
          channelId,
          externalId: o.externalId,
          orderNumber: o.orderNumber,
          placedAt: o.placedAt,
          currency: o.currency,
          subtotalCents: o.subtotalCents,
          shippingCents: o.shippingCents,
          taxCents: o.taxCents,
          totalCents: o.totalCents,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          shipName: o.ship?.name,
          shipAddress1: o.ship?.address1,
          shipAddress2: o.ship?.address2,
          shipCity: o.ship?.city,
          shipRegion: o.ship?.region,
          shipPostal: o.ship?.postal,
          shipCountry: o.ship?.country,
          items: {
            create: o.items.map((i) => ({
              sku: i.sku,
              title: i.title,
              quantity: i.quantity,
              priceCents: i.priceCents,
              productId: bySku.get(i.sku)?.id,
            })),
          },
        },
      });

      // Reserve stock for matched SKUs, then re-sync those products outward.
      for (const item of o.items) {
        const p = bySku.get(item.sku);
        if (!p) continue;
        await reserveStock(p.id, item.quantity, o.externalId);
        await syncInventoryForProduct(p.id);
      }
      imported++;
    }

    await prisma.channel.update({ where: { id: channelId }, data: { lastSyncAt: new Date() } });
    await log(channelId, "ORDER_IMPORT", "SUCCESS", `Imported ${imported} new order(s) from ${channel.name}`);
    return { ok: true, message: `Imported ${imported} new order(s)` };
  } catch (err) {
    if (err instanceof NotConfiguredError || err instanceof NotConnectedError) {
      await log(channelId, "ORDER_IMPORT", "SKIPPED", err.message);
      return { ok: true, skipped: true, message: err.message };
    }
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.channel.update({ where: { id: channelId }, data: { status: "ERROR" } });
    await log(channelId, "ORDER_IMPORT", "FAILURE", msg);
    return { ok: false, message: msg };
  }
}

// Reserve units against the default warehouse (highest available first).
async function reserveStock(productId: string, qty: number, reference: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { productId },
    orderBy: { onHand: "desc" },
  });
  let remaining = qty;
  for (const item of items) {
    if (remaining <= 0) break;
    const canReserve = Math.min(remaining, Math.max(0, item.onHand - item.reserved));
    if (canReserve <= 0) continue;
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        reserved: { increment: canReserve },
        movements: { create: { delta: -canReserve, reason: "SALE", reference } },
      },
    });
    remaining -= canReserve;
  }
}

// Send tracking back to the marketplace and mark the order shipped.
export async function pushFulfillment(
  orderId: string,
  tracking: { carrier: string; trackingNumber: string }
): Promise<SyncOutcome> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { channel: true } });
  if (!order) return { ok: false, message: "Order not found" };

  const adapter = getAdapter(order.channel.type);
  try {
    if (adapter.isConfigured() && order.channel.accessToken) {
      await adapter.pushFulfillment(order.channel, order.externalId, tracking);
      await log(order.channelId, "FULFILLMENT_PUSH", "SUCCESS", `Tracking ${tracking.trackingNumber} → ${order.channel.name}`);
    } else {
      await log(order.channelId, "FULFILLMENT_PUSH", "SKIPPED", "Channel not connected; recorded locally only");
    }
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "SHIPPED",
        carrier: tracking.carrier,
        trackingNumber: tracking.trackingNumber,
        shippedAt: new Date(),
      },
    });
    return { ok: true, message: "Marked shipped" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log(order.channelId, "FULFILLMENT_PUSH", "FAILURE", msg);
    return { ok: false, message: msg };
  }
}

// Shared error handling: missing creds → SKIPPED, real errors → mark listing.
async function handleListingError(
  err: unknown,
  listingId: string,
  channelId: string,
  channelType: string,
  kind: SyncKind
): Promise<SyncOutcome> {
  if (err instanceof NotConfiguredError || err instanceof NotConnectedError) {
    await prisma.listing.update({ where: { id: listingId }, data: { status: "DRAFT", lastError: err.message } });
    await log(channelId, kind, "SKIPPED", err.message);
    return { ok: true, skipped: true, message: err.message };
  }
  const msg = err instanceof Error ? err.message : String(err);
  await prisma.listing.update({ where: { id: listingId }, data: { status: "ERROR", lastError: msg } });
  await log(channelId, kind, "FAILURE", `${channelType}: ${msg}`);
  return { ok: false, message: msg };
}
