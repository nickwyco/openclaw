import { prisma } from "@/lib/prisma";
import { handle, notFound, ok } from "@/lib/http";
import { publishListing } from "@/lib/sync/engine";
import { ensureFreshToken } from "@/lib/sync/oauth";

export const dynamic = "force-dynamic";

// Publish (or re-publish / end) a single listing to its channel.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const listing = await prisma.listing.findUnique({ where: { id: params.id } });
    if (!listing) return notFound("Listing not found");

    const action = new URL(req.url).searchParams.get("action");
    await ensureFreshToken(listing.channelId);

    if (action === "end") {
      await prisma.listing.update({ where: { id: listing.id }, data: { status: "INACTIVE" } });
      return ok({ ok: true, message: "Listing ended" });
    }

    const outcome = await publishListing(listing.id);
    return ok(outcome);
  });
}
