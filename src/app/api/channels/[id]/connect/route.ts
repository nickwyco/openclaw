import { prisma } from "@/lib/prisma";
import { handle, badRequest, notFound, ok } from "@/lib/http";
import { getAdapter } from "@/lib/channels/registry";
import { makePkce } from "@/lib/channels/etsy";

export const dynamic = "force-dynamic";

// Begin the OAuth flow for a channel. Returns the authorization URL the user
// should be redirected to. For Etsy we also generate and stash a PKCE pair.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const channel = await prisma.channel.findUnique({ where: { id: params.id } });
    if (!channel) return notFound("Channel not found");

    const adapter = getAdapter(channel.type);
    if (!adapter.isConfigured()) {
      return badRequest(
        `${channel.type} has no API credentials configured. Add them to your .env to connect.`
      );
    }

    const state = `${channel.id}.${Buffer.from(channel.accountId).toString("base64url")}`;
    let fresh = channel;

    // Etsy uses PKCE — persist the verifier/challenge before redirecting.
    if (channel.type === "ETSY") {
      const { verifier, challenge } = makePkce();
      fresh = await prisma.channel.update({
        where: { id: channel.id },
        data: { config: { ...(channel.config as object), codeVerifier: verifier, codeChallenge: challenge } },
      });
    }

    try {
      const url = adapter.getAuthorizationUrl(state, fresh);
      return ok({ url });
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Unable to build authorization URL");
    }
  });
}
