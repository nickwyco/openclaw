import { prisma } from "@/lib/prisma";
import { handle, notFound, ok } from "@/lib/http";
import { importOrders } from "@/lib/sync/engine";
import { ensureFreshToken } from "@/lib/sync/oauth";

export const dynamic = "force-dynamic";

// Manually trigger an order import (and inventory reconciliation) for a channel.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const channel = await prisma.channel.findUnique({ where: { id: params.id } });
    if (!channel) return notFound("Channel not found");

    await ensureFreshToken(channel.id);
    const result = await importOrders(channel.id);
    return ok(result);
  });
}
