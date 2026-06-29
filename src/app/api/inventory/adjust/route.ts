import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { handle, badRequest, ok } from "@/lib/http";
import { syncInventoryForProduct } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";

const Adjust = z.object({
  productId: z.string(),
  warehouseId: z.string().optional(),
  // Either set an absolute on-hand value, or apply a relative delta.
  delta: z.number().int().optional(),
  setOnHand: z.number().int().min(0).optional(),
  reason: z
    .enum(["PURCHASE_RECEIVED", "RETURN", "ADJUSTMENT", "TRANSFER", "DAMAGE", "RECOUNT"])
    .default("ADJUSTMENT"),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const accountId = await currentAccountId();
    const input = Adjust.parse(await req.json());
    if (input.delta === undefined && input.setOnHand === undefined) {
      return badRequest("Provide either delta or setOnHand");
    }

    const warehouse = input.warehouseId
      ? await prisma.warehouse.findUnique({ where: { id: input.warehouseId } })
      : await prisma.warehouse.findFirst({ where: { accountId }, orderBy: { isDefault: "desc" } });
    if (!warehouse) return badRequest("No warehouse available");

    // Ensure an inventory row exists for this product/warehouse pair.
    let item = await prisma.inventoryItem.findFirst({
      where: { productId: input.productId, warehouseId: warehouse.id, variantId: null },
    });
    if (!item) {
      item = await prisma.inventoryItem.create({
        data: { productId: input.productId, warehouseId: warehouse.id },
      });
    }

    const delta =
      input.setOnHand !== undefined ? input.setOnHand - item.onHand : input.delta ?? 0;

    const updated = await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        onHand: { increment: delta },
        movements: { create: { delta, reason: input.reason, note: input.note } },
      },
    });

    // Touch the product so the worker and listings pick up the change, then
    // immediately push the new available quantity to every active listing.
    await prisma.product.update({ where: { id: input.productId }, data: { updatedAt: new Date() } });
    const outcomes = await syncInventoryForProduct(input.productId);

    return ok({ onHand: updated.onHand, reserved: updated.reserved, sync: outcomes });
  });
}
