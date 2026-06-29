import { prisma } from "@/lib/prisma";

// Available stock is what we are willing to sell: on-hand minus reserved.
export function available(item: { onHand: number; reserved: number }): number {
  return Math.max(0, item.onHand - item.reserved);
}

// Total available units for a product across every warehouse. This is the
// number we publish to channels.
export async function availableForProduct(productId: string): Promise<number> {
  const items = await prisma.inventoryItem.findMany({
    where: { productId },
    select: { onHand: true, reserved: true },
  });
  return items.reduce((sum, i) => sum + available(i), 0);
}
