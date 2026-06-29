import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, notFound, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

const UpdateChannel = z.object({
  name: z.string().optional(),
  priceMarkupPct: z.number().optional(),
  autoSync: z.boolean().optional(),
  shopDomain: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const channel = await prisma.channel.findUnique({
      where: { id: params.id },
      include: {
        listings: { include: { product: true } },
        syncLogs: { orderBy: { createdAt: "desc" }, take: 25 },
      },
    });
    if (!channel) return notFound("Channel not found");
    return ok(channel);
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const input = UpdateChannel.parse(await req.json());
    await prisma.channel.update({ where: { id: params.id }, data: input });
    return ok({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    await prisma.channel.delete({ where: { id: params.id } });
    return ok({ ok: true });
  });
}
