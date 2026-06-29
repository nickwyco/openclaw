import { currentAccountId } from "@/lib/account";
import { getReports } from "@/lib/reports";
import { formatMoney, centsToDollars } from "@/lib/money";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { RevenueTrend, ChannelBars, ChannelShare } from "@/components/reports/ReportsCharts";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const accountId = await currentAccountId();
  const data = await getReports(accountId, 30);

  const trend = data.salesByDay.map((d) => ({
    date: d.date,
    revenue: centsToDollars(d.revenueCents),
    orders: d.orders,
  }));
  const channelData = data.salesByChannel.map((c) => ({
    channel: c.channel,
    revenue: centsToDollars(c.revenueCents),
  }));
  const totalRevenue = data.salesByChannel.reduce((s, c) => s + c.revenueCents, 0);
  const totalOrders = data.salesByChannel.reduce((s, c) => s + c.orders, 0);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Sales performance and inventory analytics (last 30 days)" />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Revenue (30d)" value={formatMoney(totalRevenue)} tone="brand" />
          <StatCard label="Orders (30d)" value={totalOrders} />
          <StatCard label="Inventory value" value={formatMoney(data.inventoryValueCents)} tone="green" />
          <StatCard label="Units in stock" value={data.totalUnits} />
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Revenue trend</h2>
          <RevenueTrend data={trend} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Revenue by channel</h2>
            {channelData.length ? <ChannelBars data={channelData} /> : <EmptyState title="No sales yet" />}
          </div>
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Channel share</h2>
            {channelData.length ? <ChannelShare data={channelData} /> : <EmptyState title="No sales yet" />}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Top products</h2>
          </div>
          {data.topProducts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No sales in this period.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Product</th>
                  <th className="th">SKU</th>
                  <th className="th text-right">Units sold</th>
                  <th className="th text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.topProducts.map((p) => (
                  <tr key={p.sku} className="hover:bg-slate-50">
                    <td className="td font-medium">{p.title}</td>
                    <td className="td font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="td text-right">{p.unitsSold}</td>
                    <td className="td text-right font-medium">{formatMoney(p.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
