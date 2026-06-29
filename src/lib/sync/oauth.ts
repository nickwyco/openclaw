import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/channels/registry";
import type { OAuthTokens } from "@/lib/channels/types";

// Persist freshly minted OAuth tokens onto a channel and mark it connected.
export async function saveTokens(channelId: string, tokens: OAuthTokens) {
  const expires = tokens.expiresInSeconds
    ? new Date(Date.now() + tokens.expiresInSeconds * 1000)
    : null;

  await prisma.channel.update({
    where: { id: channelId },
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? undefined,
      tokenExpires: expires,
      externalId: tokens.externalId ?? undefined,
      shopDomain: tokens.shopDomain ?? undefined,
      status: "CONNECTED",
    },
  });

  await prisma.syncLog.create({
    data: { channelId, kind: "OAUTH", status: "SUCCESS", message: "Channel connected" },
  });
}

// Refresh an access token if it is missing or within 5 minutes of expiry.
export async function ensureFreshToken(channelId: string): Promise<void> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel || !channel.accessToken) return;

  const soon = Date.now() + 5 * 60 * 1000;
  const stillValid = channel.tokenExpires && channel.tokenExpires.getTime() > soon;
  if (stillValid) return;

  const adapter = getAdapter(channel.type);
  if (!adapter.refreshAccessToken || !channel.refreshToken) return;

  try {
    const tokens = await adapter.refreshAccessToken(channel);
    await saveTokens(channelId, { ...tokens, refreshToken: tokens.refreshToken ?? channel.refreshToken });
  } catch (err) {
    await prisma.channel.update({ where: { id: channelId }, data: { status: "EXPIRED" } });
    await prisma.syncLog.create({
      data: {
        channelId,
        kind: "OAUTH",
        status: "FAILURE",
        message: `Token refresh failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    });
  }
}
