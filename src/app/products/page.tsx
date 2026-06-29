import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { available } from "@/lib/inventory";
import { channelLabel } from "@/lib/channels/registry";
import { PageHeader } from "@/components/ui";
import { ProductsClient, type ProductRow } from "@/components/products/ProductsClient";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const accountId = await currentAccountId();

  const [products, channels] = await Promise.all([
    prisma.product.findMany({
      where: { accountId, archived: false },
      include: { images: { orderBy: { position: "asc" }, take: 1 }, inventoryItems: true, listings: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.channel.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } }),
  ]);

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    title: p.title,
    brand: p.brand,
    priceCents: p.priceCents,
    currency: p.currency,
    status: p.status,
    image: p.images[0]?.url ?? null,
    available: p.inventoryItems.reduce((s, i) => s + available(i), 0),
    listingCount: p.listings.length,
    activeListings: p.listings.filter((l) => l.status === "ACTIVE").length,
  }));

  const channelOptions = channels.map((c) => ({ id: c.id, name: c.name || channelLabel(c.type) }));

  return (
    <div>
      <PageHeader title="Products" subtitle="Your master catalog — one source of truth for every channel" />
      <div className="p-8">
        <ProductsClient initial={rows} channels={channelOptions} />
      </div>
    </div>
  );
}
