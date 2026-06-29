import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, notFound, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

const UpdateOrder = z.object({
  status: z
    .enum([
      "AWAITING_PAYMENT",
      "AWAITING_FULFILLMENT",
      "PARTIALLY_SHIPPED",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "REFUNDED",
      "ON_HOLD",
    ])
    .optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { channel: true, items: { include: { product: true } } },
    });
    if (!order) return notFound("Order not found");
    return ok(order);
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const input = UpdateOrder.parse(await req.json());
    await prisma.order.update({ where: { id: params.id }, data: { status: input.status } });
    return ok({ ok: true });
  });
}
