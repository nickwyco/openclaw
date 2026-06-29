import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { channelLabel } from "@/lib/channels/registry";
import { formatMoney } from "@/lib/money";
import { PageHeader, StatCard, StatusBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const accountId = await currentAccountId();

  const orders = await prisma.order.findMany({
    where: { accountId },
    include: { channel: true, items: true },
    orderBy: { placedAt: "desc" },
    take: 200,
  });

  const open = orders.filter((o) =>
    ["AWAITING_FULFILLMENT", "AWAITING_PAYMENT", "ON_HOLD", "PARTIALLY_SHIPPED"].includes(o.status)
  ).length;
  const shipped = orders.filter((o) => o.status === "SHIPPED" || o.status === "DELIVERED").length;
  const revenue = orders.reduce((s, o) => s + o.totalCents, 0);

  return (
    <div>
      <PageHeader title="Orders" subtitle="One inbox for orders from every channel" />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total orders" value={orders.length} />
          <StatCard label="Awaiting fulfillment" value={open} tone="amber" />
          <StatCard label="Shipped" value={shipped} tone="green" />
          <StatCard label="Revenue" value={formatMoney(revenue)} tone="brand" />
        </div>

        {orders.length === 0 ? (
          <EmptyState title="No orders yet" hint="Connect a channel and click “Sync now”, or seed demo data." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="th">Order</th>
                  <th className="th">Channel</th>
                  <th className="th">Buyer</th>
                  <th className="th">Items</th>
                  <th className="th">Placed</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="td font-medium">
                      <Link href={`/orders/${o.id}`} className="hover:text-brand-600">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="td">{channelLabel(o.channel.type)}</td>
                    <td className="td">{o.buyerName ?? "—"}</td>
                    <td className="td">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td className="td text-slate-500">{o.placedAt.toLocaleDateString()}</td>
                    <td className="td"><StatusBadge status={o.status} /></td>
                    <td className="td text-right font-medium">{formatMoney(o.totalCents, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
