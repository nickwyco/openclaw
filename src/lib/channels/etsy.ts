import type { ChannelType, Listing } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import { BaseAdapter } from "./base";
import {
  NotConfiguredError,
  type ChannelAdapter,
  type ChannelWithConfig,
  type NormalizedOrder,
  type OAuthTokens,
  type PublishContext,
  type PublishResult,
} from "./types";

// Etsy Open API v3. OAuth2 with PKCE. Every request needs both the OAuth
// Bearer token AND the x-api-key (keystring) header.
// Docs: https://developers.etsy.com/documentation/
const API = "https://api.etsy.com/v3/application";
const CONNECT = "https://www.etsy.com/oauth/connect";
const TOKEN = "https://api.etsy.com/v3/public/oauth/token";
const SCOPES = ["listings_r", "listings_w", "transactions_r", "transactions_w"];

// PKCE helpers. The verifier must be persisted (channel.config) between the
// authorize redirect and the token exchange.
export function makePkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export class EtsyAdapter extends BaseAdapter implements ChannelAdapter {
  readonly type: ChannelType = "ETSY";

  isConfigured(): boolean {
    return Boolean(process.env.ETSY_KEYSTRING && process.env.ETSY_SHARED_SECRET);
  }

  private headers(channel: ChannelWithConfig) {
    return {
      Authorization: `Bearer ${this.requireToken(channel)}`,
      "x-api-key": process.env.ETSY_KEYSTRING!,
    };
  }

  private shopId(channel: ChannelWithConfig): string {
    const cfg = (channel.config as Record<string, unknown>) ?? {};
    return String(channel.externalId ?? cfg.shopId ?? "");
  }

  // --- OAuth (PKCE) ----------------------------------------------------------

  getAuthorizationUrl(state: string, channel?: ChannelWithConfig): string {
    if (!this.isConfigured()) throw new NotConfiguredError(this.type);
    const cfg = (channel?.config as Record<string, unknown>) ?? {};
    const challenge = String(cfg.codeChallenge ?? "");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.ETSY_KEYSTRING!,
      redirect_uri: process.env.ETSY_REDIRECT_URI!,
      scope: SCOPES.join(" "),
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `${CONNECT}?${params.toString()}`;
  }

  async exchangeCode(code: string, channel?: ChannelWithConfig): Promise<OAuthTokens> {
    if (!this.isConfigured()) throw new NotConfiguredError(this.type);
    const cfg = (channel?.config as Record<string, unknown>) ?? {};
    const data = await this.http<EtsyToken>(TOKEN, {
      method: "POST",
      form: true,
      body: {
        grant_type: "authorization_code",
        client_id: process.env.ETSY_KEYSTRING!,
        redirect_uri: process.env.ETSY_REDIRECT_URI!,
        code,
        code_verifier: String(cfg.codeVerifier ?? ""),
      },
    });
    // Etsy access tokens are prefixed "<user_id>.<token>" — the prefix is the user id.
    const externalId = data.access_token.split(".")[0];
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: data.expires_in,
      externalId,
    };
  }

  async refreshAccessToken(channel: ChannelWithConfig): Promise<OAuthTokens> {
    if (!channel.refreshToken) throw new NotConfiguredError(this.type);
    const data = await this.http<EtsyToken>(TOKEN, {
      method: "POST",
      form: true,
      body: {
        grant_type: "refresh_token",
        client_id: process.env.ETSY_KEYSTRING!,
        refresh_token: channel.refreshToken,
      },
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: data.expires_in,
    };
  }

  // --- Listings --------------------------------------------------------------

  async publishListing(ctx: PublishContext): Promise<PublishResult> {
    const { channel, product } = ctx;
    const cfg = (channel.config as Record<string, unknown>) ?? {};
    const created = await this.http<{ listing_id: number }>(
      `${API}/shops/${this.shopId(channel)}/listings`,
      {
        method: "POST",
        headers: this.headers(channel),
        // Etsy expects application/x-www-form-urlencoded for listing creation.
        form: true,
        body: {
          quantity: String(ctx.quantity),
          title: ctx.title.slice(0, 140),
          description: ctx.description,
          price: (ctx.priceCents / 100).toFixed(2),
          who_made: String(cfg.whoMade ?? "i_did"),
          when_made: String(cfg.whenMade ?? "made_to_order"),
          taxonomy_id: String(cfg.taxonomyId ?? "1"),
          shipping_profile_id: String(cfg.shippingProfileId ?? ""),
          ...(product.sku ? { skus: product.sku } : {}),
        },
      }
    );
    return {
      externalId: String(created.listing_id),
      externalUrl: `https://www.etsy.com/listing/${created.listing_id}`,
    };
  }

  async updateListing(ctx: PublishContext): Promise<PublishResult> {
    const { channel, listing } = ctx;
    await this.http(`${API}/listings/${listing.externalId}`, {
      method: "PUT",
      headers: this.headers(channel),
      form: true,
      body: {
        title: ctx.title.slice(0, 140),
        description: ctx.description,
        price: (ctx.priceCents / 100).toFixed(2),
      },
    });
    await this.updateInventory(channel, listing, ctx.quantity);
    return { externalId: listing.externalId ?? "", externalUrl: listing.externalUrl ?? undefined };
  }

  async updateInventory(channel: ChannelWithConfig, listing: Listing, quantity: number): Promise<void> {
    // Etsy tracks stock through the listing's inventory products array.
    await this.http(`${API}/listings/${listing.externalId}/inventory`, {
      method: "PUT",
      headers: { ...this.headers(channel), "Content-Type": "application/json" },
      body: {
        products: [
          {
            sku: listing.externalId,
            offerings: [{ quantity, is_enabled: quantity > 0, price: (listing.priceCents ?? 0) / 100 }],
            property_values: [],
          },
        ],
      },
    });
  }

  async endListing(channel: ChannelWithConfig, listing: Listing): Promise<void> {
    await this.http(`${API}/listings/${listing.externalId}`, {
      method: "PUT",
      headers: this.headers(channel),
      form: true,
      body: { state: "inactive" },
    });
  }

  // --- Orders (receipts) -----------------------------------------------------

  async fetchOrders(channel: ChannelWithConfig, since: Date): Promise<NormalizedOrder[]> {
    const data = await this.http<{ results?: EtsyReceipt[] }>(
      this.buildUrl(API, `/shops/${this.shopId(channel)}/receipts`, {
        min_created: Math.floor(since.getTime() / 1000),
        limit: 100,
      }),
      { headers: this.headers(channel) }
    );
    return (data.results ?? []).map((r) => this.normalizeReceipt(r));
  }

  private normalizeReceipt(r: EtsyReceipt): NormalizedOrder {
    const money = (m?: { amount: number; divisor: number }) =>
      m ? Math.round((m.amount / m.divisor) * 100) : 0;
    return {
      externalId: String(r.receipt_id),
      orderNumber: String(r.receipt_id),
      placedAt: new Date(r.created_timestamp * 1000),
      currency: r.total_price?.currency_code ?? "USD",
      subtotalCents: money(r.subtotal),
      shippingCents: money(r.total_shipping_cost),
      taxCents: money(r.total_tax_cost),
      totalCents: money(r.grandtotal ?? r.total_price),
      buyerName: r.name,
      buyerEmail: r.buyer_email,
      ship: {
        name: r.name,
        address1: r.first_line,
        address2: r.second_line ?? undefined,
        city: r.city,
        region: r.state ?? undefined,
        postal: r.zip,
        country: r.country_iso,
      },
      items: (r.transactions ?? []).map((t) => ({
        sku: t.sku ?? String(t.listing_id),
        title: t.title,
        quantity: t.quantity,
        priceCents: money(t.price),
      })),
    };
  }

  async pushFulfillment(
    channel: ChannelWithConfig,
    externalOrderId: string,
    tracking: { carrier: string; trackingNumber: string }
  ): Promise<void> {
    await this.http(`${API}/shops/${this.shopId(channel)}/receipts/${externalOrderId}/tracking`, {
      method: "POST",
      headers: this.headers(channel),
      form: true,
      body: {
        tracking_code: tracking.trackingNumber,
        carrier_name: tracking.carrier,
        send_bcc: "true",
      },
    });
  }
}

// --- Etsy response shapes (partial) ----------------------------------------
interface EtsyToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}
interface EtsyMoney {
  amount: number;
  divisor: number;
  currency_code?: string;
}
interface EtsyReceipt {
  receipt_id: number;
  created_timestamp: number;
  name?: string;
  buyer_email?: string;
  first_line?: string;
  second_line?: string | null;
  city?: string;
  state?: string | null;
  zip?: string;
  country_iso?: string;
  subtotal?: EtsyMoney;
  total_shipping_cost?: EtsyMoney;
  total_tax_cost?: EtsyMoney;
  total_price?: EtsyMoney;
  grandtotal?: EtsyMoney;
  transactions?: {
    listing_id: number;
    sku?: string;
    title: string;
    quantity: number;
    price?: EtsyMoney;
  }[];
}
