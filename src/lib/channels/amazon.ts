import type { ChannelType, Listing } from "@prisma/client";
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

// Amazon Selling Partner API (secondary). LWA OAuth produces a refresh token
// that is exchanged for short-lived access tokens. Listings use the Listings
// Items API; orders use the Orders API.
// Docs: https://developer-docs.amazon.com/sp-api/
const ENDPOINTS: Record<string, string> = {
  na: "https://sellingpartnerapi-na.amazon.com",
  eu: "https://sellingpartnerapi-eu.amazon.com",
  fe: "https://sellingpartnerapi-fe.amazon.com",
};
const LWA_TOKEN = "https://api.amazon.com/auth/o2/token";

export class AmazonAdapter extends BaseAdapter implements ChannelAdapter {
  readonly type: ChannelType = "AMAZON";

  private get host() {
    return ENDPOINTS[process.env.AMAZON_SP_REGION ?? "na"] ?? ENDPOINTS.na;
  }

  isConfigured(): boolean {
    return Boolean(process.env.AMAZON_LWA_CLIENT_ID && process.env.AMAZON_LWA_CLIENT_SECRET);
  }

  getAuthorizationUrl(state: string): string {
    if (!this.isConfigured()) throw new NotConfiguredError(this.type);
    const params = new URLSearchParams({
      application_id: process.env.AMAZON_LWA_CLIENT_ID!,
      state,
      version: "beta",
    });
    return `https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`;
  }

  // LWA exchanges the authorization (refresh) token for an access token.
  async exchangeCode(code: string): Promise<OAuthTokens> {
    if (!this.isConfigured()) throw new NotConfiguredError(this.type);
    const data = await this.lwa({ grant_type: "authorization_code", code });
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresInSeconds: data.expires_in };
  }

  async refreshAccessToken(channel: ChannelWithConfig): Promise<OAuthTokens> {
    const refresh = channel.refreshToken ?? process.env.AMAZON_REFRESH_TOKEN;
    if (!refresh) throw new NotConfiguredError(this.type);
    const data = await this.lwa({ grant_type: "refresh_token", refresh_token: refresh });
    return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
  }

  private lwa(extra: Record<string, string>) {
    return this.http<{ access_token: string; refresh_token?: string; expires_in: number }>(LWA_TOKEN, {
      method: "POST",
      form: true,
      body: {
        ...extra,
        client_id: process.env.AMAZON_LWA_CLIENT_ID!,
        client_secret: process.env.AMAZON_LWA_CLIENT_SECRET!,
      },
    });
  }

  private headers(channel: ChannelWithConfig) {
    return { "x-amz-access-token": this.requireToken(channel) };
  }

  async publishListing(ctx: PublishContext): Promise<PublishResult> {
    const { channel, product } = ctx;
    const cfg = (channel.config as Record<string, unknown>) ?? {};
    const sellerId = channel.externalId ?? String(cfg.sellerId ?? "");
    const marketplaceId = String(cfg.marketplaceId ?? "ATVPDKIKX0DER");

    await this.http(
      this.buildUrl(this.host, `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(product.sku)}`, {
        marketplaceIds: marketplaceId,
      }),
      {
        method: "PUT",
        headers: this.headers(channel),
        body: {
          productType: String(cfg.productType ?? "PRODUCT"),
          requirements: "LISTING",
          attributes: {
            condition_type: [{ value: "new_new" }],
            merchant_suggested_asin: product.upc ? [{ value: product.upc }] : undefined,
            item_name: [{ value: ctx.title }],
            purchasable_offer: [
              { currency: product.currency, our_price: [{ schedule: [{ value_with_tax: ctx.priceCents / 100 }] }] },
            ],
            fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: ctx.quantity }],
          },
        },
      }
    );
    return { externalId: product.sku, externalUrl: product.upc ? `https://www.amazon.com/dp/${product.upc}` : undefined };
  }

  async updateListing(ctx: PublishContext): Promise<PublishResult> {
    return this.publishListing(ctx);
  }

  async updateInventory(channel: ChannelWithConfig, listing: Listing, quantity: number): Promise<void> {
    const cfg = (channel.config as Record<string, unknown>) ?? {};
    const sellerId = channel.externalId ?? String(cfg.sellerId ?? "");
    const marketplaceId = String(cfg.marketplaceId ?? "ATVPDKIKX0DER");
    await this.http(
      this.buildUrl(this.host, `/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(listing.externalId ?? "")}`, {
        marketplaceIds: marketplaceId,
      }),
      {
        method: "PATCH",
        headers: this.headers(channel),
        body: {
          productType: String(cfg.productType ?? "PRODUCT"),
          patches: [
            { op: "replace", path: "/attributes/fulfillment_availability", value: [{ fulfillment_channel_code: "DEFAULT", quantity }] },
          ],
        },
      }
    );
  }

  async endListing(channel: ChannelWithConfig, listing: Listing): Promise<void> {
    await this.updateInventory(channel, listing, 0);
  }

  async fetchOrders(channel: ChannelWithConfig, since: Date): Promise<NormalizedOrder[]> {
    const cfg = (channel.config as Record<string, unknown>) ?? {};
    const marketplaceId = String(cfg.marketplaceId ?? "ATVPDKIKX0DER");
    const data = await this.http<{ payload?: { Orders?: AmazonOrder[] } }>(
      this.buildUrl(this.host, "/orders/v0/orders", {
        MarketplaceIds: marketplaceId,
        CreatedAfter: since.toISOString(),
      }),
      { headers: this.headers(channel) }
    );
    return (data.payload?.Orders ?? []).map((o) => this.normalize(o));
  }

  private normalize(o: AmazonOrder): NormalizedOrder {
    const cents = (s?: string) => Math.round(parseFloat(s ?? "0") * 100);
    return {
      externalId: o.AmazonOrderId,
      orderNumber: o.AmazonOrderId,
      placedAt: new Date(o.PurchaseDate),
      currency: o.OrderTotal?.CurrencyCode ?? "USD",
      subtotalCents: cents(o.OrderTotal?.Amount),
      shippingCents: 0,
      taxCents: 0,
      totalCents: cents(o.OrderTotal?.Amount),
      buyerName: o.ShippingAddress?.Name,
      ship: o.ShippingAddress
        ? {
            name: o.ShippingAddress.Name,
            address1: o.ShippingAddress.AddressLine1,
            city: o.ShippingAddress.City,
            region: o.ShippingAddress.StateOrRegion,
            postal: o.ShippingAddress.PostalCode,
            country: o.ShippingAddress.CountryCode,
          }
        : undefined,
      items: [], // Order items come from a separate /orderItems call per order.
    };
  }

  async pushFulfillment(): Promise<void> {
    // Amazon fulfillment is reported via feeds; left as a no-op in scaffolding.
    return;
  }
}

interface AmazonOrder {
  AmazonOrderId: string;
  PurchaseDate: string;
  OrderTotal?: { CurrencyCode?: string; Amount?: string };
  ShippingAddress?: {
    Name?: string;
    AddressLine1?: string;
    City?: string;
    StateOrRegion?: string;
    PostalCode?: string;
    CountryCode?: string;
  };
}
