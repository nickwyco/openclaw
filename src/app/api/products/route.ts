import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { available } from "@/lib/inventory";
import { handle, ok } from "@/lib/http";
import { dollarsToCents } from "@/lib/money";

export const dynamic = "force-dynamic";

const CreateProduct = z.object({
  sku: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  condition: z
    .enum(["NEW", "USED_LIKE_NEW", "USED_GOOD", "USED_ACCEPTABLE", "REFURBISHED", "FOR_PARTS"])
    .default("NEW"),
  price: z.union([z.string(), z.number()]).default(0),
  cost: z.union([z.string(), z.number()]).default(0),
  upc: z.string().optional(),
  mpn: z.string().optional(),
  weightGrams: z.number().int().optional(),
  initialQty: z.number().int().min(0).default(0),
  imageUrl: z.string().url().optional(),
});

export async function GET(req: Request) {
  return handle(async () => {
    const accountId = await currentAccountId();
    const q = new URL(req.url).searchParams.get("q")?.trim();

    const products = await prisma.product.findMany({
      where: {
        accountId,
        archived: false,
        ...(q
          ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      include: { images: { orderBy: { position: "asc" }, take: 1 }, inventoryItems: true, listings: true },
      orderBy: { updatedAt: "desc" },
    });

    return ok(
      products.map((p) => ({
        id: p.id,
        sku: p.sku,
        title: p.title,
        brand: p.brand,
        priceCents: p.priceCents,
        costCents: p.costCents,
        currency: p.currency,
        status: p.status,
        image: p.images[0]?.url ?? null,
        available: p.inventoryItems.reduce((s, i) => s + available(i), 0),
        listingCount: p.listings.length,
        activeListings: p.listings.filter((l) => l.status === "ACTIVE").length,
      }))
    );
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const accountId = await currentAccountId();
    const input = CreateProduct.parse(await req.json());

    const warehouse = await prisma.warehouse.findFirst({
      where: { accountId },
      orderBy: { isDefault: "desc" },
    });

    const product = await prisma.product.create({
      data: {
        accountId,
        sku: input.sku,
        title: input.title,
        description: input.description,
        brand: input.brand,
        category: input.category,
        condition: input.condition,
        priceCents: dollarsToCents(input.price),
        costCents: dollarsToCents(input.cost),
        upc: input.upc,
        mpn: input.mpn,
        weightGrams: input.weightGrams,
        images: input.imageUrl ? { create: { url: input.imageUrl, position: 0 } } : undefined,
        inventoryItems:
          warehouse && input.initialQty >= 0
            ? {
                create: {
                  warehouseId: warehouse.id,
                  onHand: input.initialQty,
                  movements:
                    input.initialQty > 0
                      ? { create: { delta: input.initialQty, reason: "PURCHASE_RECEIVED", note: "Initial stock" } }
                      : undefined,
                },
              }
            : undefined,
      },
    });

    return ok({ id: product.id }, { status: 201 });
  });
}
