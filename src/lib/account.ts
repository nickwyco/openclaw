import { prisma } from "@/lib/prisma";

// This build is single-tenant: there is exactly one Account, created by the
// seed. A real deployment would resolve the account from the authenticated
// session. Centralizing it here means swapping in real auth later is a
// one-function change.
export async function currentAccountId(): Promise<string> {
  const account = await prisma.account.findFirst({ orderBy: { createdAt: "asc" } });
  if (!account) {
    throw new Error("No account found. Run `npm run db:seed` to initialize.");
  }
  return account.id;
}
