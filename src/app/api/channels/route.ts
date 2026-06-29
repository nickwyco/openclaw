import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { handle, ok } from "@/lib/http";
import { listChannelTypes } from "@/lib/channels/registry";

export const dynamic = "force-dynamic";

const CreateChannel = z.object({
  type: z.enum(["EBAY", "ETSY", "SHOPIFY", "AMAZON", "WALMART"]),
  name: z.string().min(1),
  shopDomain: z.string().optional(), // shopify
  priceMarkupPct: z.number().default(0),
});

export async function GET() {
  return handle(async () => {
    const accountId = await currentAccountId();
    const channels = await prisma.channel.findMany({
      where: { accountId },
      include: { _count: { select: { listings: true, orders: true } } },
      orderBy: { createdAt: "asc" },
    });
    return ok({ channels, types: listChannelTypes() });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const accountId = await currentAccountId();
    const input = CreateChannel.parse(await req.json());
    const channel = await prisma.channel.create({
      data: {
        accountId,
        type: input.type,
        name: input.name,
        shopDomain: input.shopDomain,
        priceMarkupPct: input.priceMarkupPct,
        status: "DISCONNECTED",
      },
    });
    return ok({ id: channel.id }, { status: 201 });
  });
}
