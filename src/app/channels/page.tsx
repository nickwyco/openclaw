import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { channelLabel, listChannelTypes } from "@/lib/channels/registry";
import { PageHeader } from "@/components/ui";
import { ChannelsClient, type ChannelRow } from "@/components/channels/ChannelsClient";

export const dynamic = "force-dynamic";

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: { connected?: string; error?: string };
}) {
  const accountId = await currentAccountId();
  const channels = await prisma.channel.findMany({
    where: { accountId },
    include: { _count: { select: { listings: true, orders: true } } },
    orderBy: { createdAt: "asc" },
  });

  const rows: ChannelRow[] = channels.map((c) => ({
    id: c.id,
    type: c.type,
    name: c.name || channelLabel(c.type),
    status: c.status,
    shopDomain: c.shopDomain,
    priceMarkupPct: c.priceMarkupPct,
    autoSync: c.autoSync,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
    listings: c._count.listings,
    orders: c._count.orders,
  }));

  const flash = searchParams.connected
    ? { kind: "ok" as const, message: `Connected ${searchParams.connected} successfully.` }
    : searchParams.error
    ? { kind: "err" as const, message: `Connection failed: ${searchParams.error.replace(/_/g, " ")}.` }
    : null;

  return (
    <div>
      <PageHeader title="Channels" subtitle="Connect and manage your marketplace integrations" />
      <div className="p-8">
        <ChannelsClient channels={rows} types={listChannelTypes()} flash={flash} />
      </div>
    </div>
  );
}
