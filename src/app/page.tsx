import Link from "next/link";
import { currentAccountId } from "@/lib/account";
import { getDashboard } from "@/lib/reports";
import { formatMoney } from "@/lib/money";
import { PageHeader, StatCard, StatusBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const accountId = await currentAccountId();
  const data = await getDashboard(accountId);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your multichannel business at a glance" />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Revenue (30d)" value={formatMoney(data.revenue30dCents)} sub={`${data.orders30d} orders`} tone="brand" />
          <StatCard label="Open orders" value={data.openOrders} sub="awaiting fulfillment" tone="amber" />
          <StatCard label="Active listings" value={data.activeListings} sub={`${data.productCount} products`} tone="green" />
          <StatCard label="Connected channels" value={data.connectedChannels} sub="marketplaces" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-slate-700">Recent orders</h2>
              <Link href="/orders" className="text-xs font-medium text-brand-600 hover:underline">
                View all
              </Link>
            </div>
            {data.recentOrders.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No orders yet" hint="Connect a channel and sync, or seed demo data." />
              </div>
            ) : (
              <table className="w-full">
                <thead className="border-b border-slate-100">
                  <tr>
                    <th className="th">Order</th>
                    <th className="th">Channel</th>
                    <th className="th">Buyer</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="td font-medium">
                        <Link href={`/orders/${o.id}`} className="hover:text-brand-600">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="td">{o.channel}</td>
                      <td className="td">{o.buyer ?? "—"}</td>
                      <td className="td"><StatusBadge status={o.status} /></td>
                      <td className="td text-right font-medium">{formatMoney(o.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="space-y-6">
            <div className="card">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-sm font-semibold text-slate-700">Low stock</h2>
              </div>
              {data.lowStock.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">Everything is well stocked.</p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {data.lowStock.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="text-sm font-medium text-slate-700">{p.title}</div>
                        <div className="text-xs text-slate-400">{p.sku}</div>
                      </div>
                      <span className="badge bg-red-50 text-red-700">{p.available} left</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {data.needsAttention.length > 0 && (
              <div className="card border-red-200">
                <div className="border-b border-slate-100 px-5 py-3">
                  <h2 className="text-sm font-semibold text-red-600">Listings needing attention</h2>
                </div>
                <ul className="divide-y divide-slate-50">
                  {data.needsAttention.map((l) => (
                    <li key={l.id} className="px-5 py-3">
                      <div className="text-sm font-medium text-slate-700">
                        {l.sku} · {l.channel}
                      </div>
                      <div className="truncate text-xs text-red-500">{l.error}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
