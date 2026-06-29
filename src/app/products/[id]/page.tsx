import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { available } from "@/lib/inventory";
import { channelLabel } from "@/lib/channels/registry";
import { formatMoney } from "@/lib/money";
import { PageHeader, StatusBadge } from "@/components/ui";
import { ProductDetailClient } from "@/components/products/ProductDetailClient";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const accountId = await currentAccountId();

  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      images: { orderBy: { position: "asc" } },
      inventoryItems: { include: { warehouse: true } },
      listings: { include: { channel: true } },
    },
  });
  if (!product) notFound();

  const channels = await prisma.channel.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } });
  const listedChannelIds = new Set(product.listings.map((l) => l.channelId));

  const totalAvailable = product.inventoryItems.reduce((s, i) => s + available(i), 0);

  return (
    <div>
      <PageHeader
        title={product.title}
        subtitle={`SKU ${product.sku}`}
        action={
          <Link href="/products" className="btn-ghost">
            ← Back to products
          </Link>
        }
      />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card flex gap-4 p-5 lg:col-span-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.images[0]?.url ?? "https://placehold.co/96x96/eef/99a?text=%20"}
              alt=""
              className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
            />
            <div className="space-y-1">
              <StatusBadge status={product.status} />
              <div className="text-lg font-bold text-slate-900">{formatMoney(product.priceCents, product.currency)}</div>
              <div className="text-xs text-slate-400">Cost {formatMoney(product.costCents, product.currency)}</div>
              <div className="text-sm text-slate-600">{totalAvailable} available</div>
              {product.brand && <div className="text-xs text-slate-400">{product.brand}</div>}
            </div>
          </div>
          <div className="card p-5 lg:col-span-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="UPC" value={product.upc} />
              <Field label="MPN" value={product.mpn} />
              <Field label="Brand" value={product.brand} />
              <Field label="Category" value={product.category} />
              <Field label="Condition" value={product.condition.replace(/_/g, " ").toLowerCase()} />
              <Field label="Weight" value={product.weightGrams ? `${product.weightGrams} g` : null} />
            </div>
            {product.description && (
              <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm text-slate-600">
                {product.description}
              </p>
            )}
          </div>
        </div>

        <ProductDetailClient
          productId={product.id}
          priceCents={product.priceCents}
          currency={product.currency}
          inventory={product.inventoryItems.map((i) => ({
            id: i.warehouseId,
            warehouse: i.warehouse.name,
            onHand: i.onHand,
            reserved: i.reserved,
            available: available(i),
          }))}
          listings={product.listings.map((l) => ({
            id: l.id,
            channelId: l.channelId,
            channel: l.channel.name || channelLabel(l.channel.type),
            status: l.status,
            externalUrl: l.externalUrl,
            priceCents: l.priceCents,
            publishedQty: l.publishedQty,
            lastError: l.lastError,
          }))}
          channels={channels.map((c) => ({
            id: c.id,
            name: c.name || channelLabel(c.type),
            alreadyListed: listedChannelIds.has(c.id),
          }))}
        />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between border-b border-slate-50 py-1">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">{value || "—"}</span>
    </div>
  );
}
