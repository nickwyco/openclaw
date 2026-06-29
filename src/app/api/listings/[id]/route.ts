import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok } from "@/lib/http";
import { dollarsToCents } from "@/lib/money";

export const dynamic = "force-dynamic";

const UpdateListing = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const input = UpdateListing.parse(await req.json());
    await prisma.listing.update({
      where: { id: params.id },
      data: {
        title: input.title,
        description: input.description,
        priceCents: input.price !== undefined ? dollarsToCents(input.price) : undefined,
      },
    });
    return ok({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    await prisma.listing.delete({ where: { id: params.id } });
    return ok({ ok: true });
  });
}
