import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/channels/registry";
import { saveTokens } from "@/lib/sync/oauth";

export const dynamic = "force-dynamic";

// Unified OAuth redirect handler for every marketplace. The `state` we sent
// during /connect carries the channel id, so one endpoint serves all channels.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const shop = url.searchParams.get("shop"); // shopify includes this
  const appUrl = process.env.APP_URL ?? url.origin;

  const channelId = state.split(".")[0];
  if (!code || !channelId) {
    return NextResponse.redirect(`${appUrl}/channels?error=missing_code`);
  }

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    return NextResponse.redirect(`${appUrl}/channels?error=unknown_channel`);
  }

  // Shopify needs the shop domain stored before token exchange.
  let working = channel;
  if (shop && channel.type === "SHOPIFY") {
    working = await prisma.channel.update({ where: { id: channel.id }, data: { shopDomain: shop } });
  }

  try {
    const adapter = getAdapter(channel.type);
    const tokens = await adapter.exchangeCode(code, working);
    await saveTokens(channel.id, tokens);
    return NextResponse.redirect(`${appUrl}/channels?connected=${channel.type.toLowerCase()}`);
  } catch (err) {
    await prisma.syncLog.create({
      data: {
        channelId: channel.id,
        kind: "OAUTH",
        status: "FAILURE",
        message: `OAuth exchange failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    });
    await prisma.channel.update({ where: { id: channel.id }, data: { status: "ERROR" } });
    return NextResponse.redirect(`${appUrl}/channels?error=oauth_failed`);
  }
}
