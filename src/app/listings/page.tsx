import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { channelLabel } from "@/lib/channels/registry";
import { PageHeader } from "@/components/ui";
import { ListingsClient, type ListingRow } from "@/components/listings/ListingsClient";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const accountId = await currentAccountId();

  const listings = await prisma.listing.findMany({
    where: { product: { accountId } },
    include: {
      channel: true,
      product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows: ListingRow[] = listings.map((l) => ({
    id: l.id,
    productId: l.productId,
    productTitle: l.product.title,
    sku: l.product.sku,
    image: l.product.images[0]?.url ?? null,
    channel: l.channel.name || channelLabel(l.channel.type),
    status: l.status,
    priceCents: l.priceCents ?? l.product.priceCents,
    publishedQty: l.publishedQty,
    externalUrl: l.externalUrl,
    lastError: l.lastError,
  }));

  return (
    <div>
      <PageHeader title="Listings" subtitle="Every product/channel listing and its live sync status" />
      <div className="p-8">
        <ListingsClient rows={rows} />
      </div>
    </div>
  );
}
