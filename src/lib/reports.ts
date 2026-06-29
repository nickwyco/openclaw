import { prisma } from "@/lib/prisma";
import { available } from "@/lib/inventory";
import { channelLabel } from "@/lib/channels/registry";
import type { ChannelType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Read models for the dashboard and reports pages. Kept server-side so pages
// can call them directly without round-tripping through an API route.
// ---------------------------------------------------------------------------

export interface DashboardData {
  productCount: number;
  activeListings: number;
  connectedChannels: number;
  openOrders: number;
  revenue30dCents: number;
  orders30d: number;
  lowStock: { id: string; sku: string; title: string; available: number; reorderPoint: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    channel: string;
    buyer: string | null;
    totalCents: number;
    status: string;
    placedAt: Date;
  }[];
  needsAttention: { id: string; sku: string; channel: string; error: string }[];
}

export async function getDashboard(accountId: string): Promise<DashboardData> {
  const thirtyDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);

  const [productCount, activeListings, connectedChannels, openOrders, orders30d, inventoryItems, recent, errored] =
    await Promise.all([
      prisma.product.count({ where: { accountId, archived: false } }),
      prisma.listing.count({ where: { product: { accountId }, status: "ACTIVE" } }),
      prisma.channel.count({ where: { accountId, status: "CONNECTED" } }),
      prisma.order.count({
        where: { accountId, status: { in: ["AWAITING_FULFILLMENT", "AWAITING_PAYMENT", "ON_HOLD", "PARTIALLY_SHIPPED"] } },
      }),
      prisma.order.findMany({
        where: { accountId, placedAt: { gte: thirtyDaysAgo } },
        select: { totalCents: true },
      }),
      prisma.inventoryItem.findMany({
        where: { product: { accountId, archived: false }, reorderPoint: { gt: 0 } },
        include: { product: true },
      }),
      prisma.order.findMany({
        where: { accountId },
        include: { channel: true },
        orderBy: { placedAt: "desc" },
        take: 8,
      }),
      prisma.listing.findMany({
        where: { product: { accountId }, status: "ERROR" },
        include: { channel: true, product: true },
        take: 10,
      }),
    ]);

  const revenue30dCents = orders30d.reduce((s, o) => s + o.totalCents, 0);

  const lowStock = inventoryItems
    .filter((i) => available(i) <= i.reorderPoint)
    .slice(0, 8)
    .map((i) => ({
      id: i.product.id,
      sku: i.product.sku,
      title: i.product.title,
      available: available(i),
      reorderPoint: i.reorderPoint,
    }));

  return {
    productCount,
    activeListings,
    connectedChannels,
    openOrders,
    revenue30dCents,
    orders30d: orders30d.length,
    lowStock,
    recentOrders: recent.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      channel: channelLabel(o.channel.type),
      buyer: o.buyerName,
      totalCents: o.totalCents,
      status: o.status,
      placedAt: o.placedAt,
    })),
    needsAttention: errored.map((l) => ({
      id: l.id,
      sku: l.product.sku,
      channel: channelLabel(l.channel.type),
      error: l.lastError ?? "Unknown error",
    })),
  };
}

export interface ReportData {
  salesByChannel: { channel: string; orders: number; revenueCents: number }[];
  salesByDay: { date: string; revenueCents: number; orders: number }[];
  topProducts: { sku: string; title: string; unitsSold: number; revenueCents: number }[];
  inventoryValueCents: number;
  totalUnits: number;
}

export async function getReports(accountId: string, days = 30): Promise<ReportData> {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * days);

  const orders = await prisma.order.findMany({
    where: { accountId, placedAt: { gte: since } },
    include: { channel: true, items: true },
  });

  const byChannel = new Map<ChannelType, { orders: number; revenueCents: number }>();
  const byDay = new Map<string, { revenueCents: number; orders: number }>();
  const byProduct = new Map<string, { title: string; unitsSold: number; revenueCents: number }>();

  for (const o of orders) {
    const c = byChannel.get(o.channel.type) ?? { orders: 0, revenueCents: 0 };
    c.orders += 1;
    c.revenueCents += o.totalCents;
    byChannel.set(o.channel.type, c);

    const day = o.placedAt.toISOString().slice(0, 10);
    const d = byDay.get(day) ?? { revenueCents: 0, orders: 0 };
    d.revenueCents += o.totalCents;
    d.orders += 1;
    byDay.set(day, d);

    for (const item of o.items) {
      const p = byProduct.get(item.sku) ?? { title: item.title, unitsSold: 0, revenueCents: 0 };
      p.unitsSold += item.quantity;
      p.revenueCents += item.priceCents * item.quantity;
      byProduct.set(item.sku, p);
    }
  }

  // Inventory valuation at cost.
  const items = await prisma.inventoryItem.findMany({
    where: { product: { accountId, archived: false } },
    include: { product: true },
  });
  const inventoryValueCents = items.reduce((s, i) => s + i.onHand * i.product.costCents, 0);
  const totalUnits = items.reduce((s, i) => s + i.onHand, 0);

  // Fill missing days so the chart is continuous.
  const salesByDay: ReportData["salesByDay"] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 1000 * 60 * 60 * 24).toISOString().slice(0, 10);
    const v = byDay.get(date) ?? { revenueCents: 0, orders: 0 };
    salesByDay.push({ date, ...v });
  }

  return {
    salesByChannel: [...byChannel.entries()].map(([type, v]) => ({ channel: channelLabel(type), ...v })),
    salesByDay,
    topProducts: [...byProduct.entries()]
      .map(([sku, v]) => ({ sku, ...v }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, 10),
    inventoryValueCents,
    totalUnits,
  };
}
