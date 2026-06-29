import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { available } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { PageHeader, StatCard } from "@/components/ui";
import { InventoryClient, type InvRow } from "@/components/inventory/InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const accountId = await currentAccountId();

  const items = await prisma.inventoryItem.findMany({
    where: { product: { accountId, archived: false } },
    include: { product: true, warehouse: true },
    orderBy: [{ product: { title: "asc" } }],
  });

  const rows: InvRow[] = items.map((i) => {
    const avail = available(i);
    return {
      productId: i.productId,
      sku: i.product.sku,
      title: i.product.title,
      warehouse: i.warehouse.name,
      onHand: i.onHand,
      reserved: i.reserved,
      available: avail,
      reorderPoint: i.reorderPoint,
      low: avail <= i.reorderPoint,
    };
  });

  const totalUnits = items.reduce((s, i) => s + i.onHand, 0);
  const reservedUnits = items.reduce((s, i) => s + i.reserved, 0);
  const valueCents = items.reduce((s, i) => s + i.onHand * i.product.costCents, 0);
  const lowCount = rows.filter((r) => r.low).length;

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Multi-warehouse stock — the single source of truth synced to every channel" />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Units on hand" value={totalUnits} />
          <StatCard label="Reserved" value={reservedUnits} tone="amber" />
          <StatCard label="Inventory value (cost)" value={formatMoney(valueCents)} tone="brand" />
          <StatCard label="Low / out of stock" value={lowCount} tone={lowCount ? "red" : "green"} />
        </div>
        <InventoryClient rows={rows} />
      </div>
    </div>
  );
}
