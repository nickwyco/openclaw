import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { pushFulfillment } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";

const Fulfill = z.object({
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
});

// Record a shipment and push the tracking number back to the marketplace.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const input = Fulfill.parse(await req.json());
    const outcome = await pushFulfillment(params.id, input);
    return ok(outcome);
  });
}
