import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, notFound, ok } from "@/lib/http";
import { dollarsToCents } from "@/lib/money";
import { syncInventoryForProduct } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";

const UpdateProduct = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  price: z.union([z.string(), z.number()]).optional(),
  cost: z.union([z.string(), z.number()]).optional(),
  upc: z.string().optional(),
  mpn: z.string().optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        images: { orderBy: { position: "asc" } },
        inventoryItems: { include: { warehouse: true } },
        listings: { include: { channel: true } },
        variants: true,
      },
    });
    if (!product) return notFound("Product not found");
    return ok(product);
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const input = UpdateProduct.parse(await req.json());
    const priceChanged = input.price !== undefined;

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        title: input.title,
        description: input.description,
        brand: input.brand,
        category: input.category,
        priceCents: input.price !== undefined ? dollarsToCents(input.price) : undefined,
        costCents: input.cost !== undefined ? dollarsToCents(input.cost) : undefined,
        upc: input.upc,
        mpn: input.mpn,
        status: input.status,
      },
    });

    // A price change should propagate to live listings on a re-publish; stock
    // is always reconciled so channels stay accurate.
    if (priceChanged) await syncInventoryForProduct(product.id);

    return ok({ id: product.id });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    // Soft-delete: archive rather than destroy so order history stays intact.
    await prisma.product.update({
      where: { id: params.id },
      data: { archived: true, status: "ARCHIVED" },
    });
    return ok({ ok: true });
  });
}
