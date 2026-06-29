import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { handle, badRequest, ok } from "@/lib/http";
import { dollarsToCents } from "@/lib/money";
import { publishListing } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";

const CreateListing = z.object({
  productId: z.string(),
  channelId: z.string(),
  price: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  templateId: z.string().optional(),
  publishNow: z.boolean().default(false),
});

// Bulk: list many products to many channels at once (Sellbrite-style).
const BulkCreate = z.object({
  productIds: z.array(z.string()).min(1),
  channelIds: z.array(z.string()).min(1),
  publishNow: z.boolean().default(false),
});

export async function GET() {
  return handle(async () => {
    const accountId = await currentAccountId();
    const listings = await prisma.listing.findMany({
      where: { product: { accountId } },
      include: { channel: true, product: { include: { images: { take: 1 } } } },
      orderBy: { updatedAt: "desc" },
    });
    return ok(listings);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();

    if (Array.isArray(body.productIds)) {
      const input = BulkCreate.parse(body);
      const created: string[] = [];
      for (const productId of input.productIds) {
        for (const channelId of input.channelIds) {
          const listing = await prisma.listing.upsert({
            where: { productId_channelId: { productId, channelId } },
            create: { productId, channelId, status: "DRAFT" },
            update: {},
          });
          created.push(listing.id);
          if (input.publishNow) await publishListing(listing.id);
        }
      }
      return ok({ created: created.length, listingIds: created }, { status: 201 });
    }

    const input = CreateListing.parse(body);
    const existing = await prisma.listing.findUnique({
      where: { productId_channelId: { productId: input.productId, channelId: input.channelId } },
    });
    if (existing) return badRequest("This product is already listed on that channel");

    const listing = await prisma.listing.create({
      data: {
        productId: input.productId,
        channelId: input.channelId,
        title: input.title,
        templateId: input.templateId,
        priceCents: input.price !== undefined ? dollarsToCents(input.price) : undefined,
        status: "DRAFT",
      },
    });

    if (input.publishNow) {
      const outcome = await publishListing(listing.id);
      return ok({ id: listing.id, outcome }, { status: 201 });
    }
    return ok({ id: listing.id }, { status: 201 });
  });
}
