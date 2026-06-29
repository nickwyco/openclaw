import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { channelLabel } from "@/lib/channels/registry";
import { formatMoney } from "@/lib/money";
import { PageHeader, StatusBadge } from "@/components/ui";
import { FulfillBox } from "@/components/orders/FulfillBox";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { channel: true, items: { include: { product: true } } },
  });
  if (!order) notFound();

  const shipped = order.status === "SHIPPED" || order.status === "DELIVERED";

  return (
    <div>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        subtitle={`${channelLabel(order.channel.type)} · ${order.placedAt.toLocaleString()}`}
        action={
          <Link href="/orders" className="btn-ghost">
            ← Back to orders
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-700">Items</h2>
              <StatusBadge status={order.status} />
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Item</th>
                  <th className="th">SKU</th>
                  <th className="th text-right">Qty</th>
                  <th className="th text-right">Price</th>
                  <th className="th text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td className="td">
                      {it.product ? (
                        <Link href={`/products/${it.product.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                          {it.title}
                        </Link>
                      ) : (
                        <span className="text-slate-700">{it.title}</span>
                      )}
                      {!it.product && <span className="ml-2 badge bg-amber-50 text-amber-700">unmatched SKU</span>}
                    </td>
                    <td className="td font-mono text-xs text-slate-500">{it.sku}</td>
                    <td className="td text-right">{it.quantity}</td>
                    <td className="td text-right">{formatMoney(it.priceCents, order.currency)}</td>
                    <td className="td text-right font-medium">{formatMoney(it.priceCents * it.quantity, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 border-t border-slate-100 px-5 py-4 text-sm">
              <Row label="Subtotal" value={formatMoney(order.subtotalCents, order.currency)} />
              <Row label="Shipping" value={formatMoney(order.shippingCents, order.currency)} />
              <Row label="Tax" value={formatMoney(order.taxCents, order.currency)} />
              <Row label="Total" value={formatMoney(order.totalCents, order.currency)} bold />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Fulfillment</h2>
            <FulfillBox orderId={order.id} shipped={shipped} />
            {order.trackingNumber && (
              <p className="mt-3 text-sm text-slate-500">
                {order.carrier} · {order.trackingNumber}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Customer</h2>
            <div className="text-sm text-slate-700">{order.buyerName ?? "—"}</div>
            {order.buyerEmail && <div className="text-xs text-slate-400">{order.buyerEmail}</div>}
          </div>
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Ship to</h2>
            <address className="text-sm not-italic leading-relaxed text-slate-600">
              {order.shipName}
              <br />
              {order.shipAddress1}
              {order.shipAddress2 && (
                <>
                  <br />
                  {order.shipAddress2}
                </>
              )}
              <br />
              {[order.shipCity, order.shipRegion, order.shipPostal].filter(Boolean).join(", ")}
              <br />
              {order.shipCountry}
            </address>
          </div>
          <div className="card p-5">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Payment</h2>
            <StatusBadge status={order.financialStatus} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t border-slate-100 pt-2 font-semibold text-slate-900" : "text-slate-500"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
