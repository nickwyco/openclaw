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

// eBay Sell APIs (Inventory + Fulfillment), OAuth2 user tokens.
// Docs: https://developer.ebay.com/api-docs/sell/static/overview.html
//
// Listing flow on eBay's Inventory API is three steps:
//   1. PUT  /sell/inventory/v1/inventory_item/{sku}     (catalog + availability)
//   2. POST /sell/inventory/v1/offer                    (price + marketplace)
//   3. POST /sell/inventory/v1/offer/{offerId}/publish  (go live -> listingId)
const PROD = {
  auth: "https://auth.ebay.com/oauth2/authorize",
  token: "https://api.ebay.com/identity/v1/oauth2/token",
  api: "https://api.ebay.com",
};
const SANDBOX = {
  auth: "https://auth.sandbox.ebay.com/oauth2/authorize",
  token: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
  api: "https://api.sandbox.ebay.com",
};

const SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
];

export class EbayAdapter extends BaseAdapter implements ChannelAdapter {
  readonly type: ChannelType = "EBAY";

  private get env() {
    return process.env.EBAY_ENV === "PRODUCTION" ? PROD : SANDBOX;
  }
  private get marketplaceId() {
    return "EBAY_US";
  }

  isConfigured(): boolean {
    return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
  }

  private basicAuthHeader(): string {
    const raw = `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`;
    return `Basic ${Buffer.from(raw).toString("base64")}`;
  }

  private authHeaders(channel: ChannelWithConfig) {
    return {
      Authorization: `Bearer ${this.requireToken(channel)}`,
      "X-EBAY-C-MARKETPLACE-ID": this.marketplaceId,
      "Content-Language": "en-US",
    };
  }

  // --- OAuth -----------------------------------------------------------------

  getAuthorizationUrl(state: string): string {
    if (!this.isConfigured()) throw new NotConfiguredError(this.type);
    const params = new URLSearchParams({
      client_id: process.env.EBAY_CLIENT_ID!,
      redirect_uri: process.env.EBAY_RU_NAME ?? process.env.EBAY_REDIRECT_URI!,
      response_type: "code",
      scope: SCOPES.join(" "),
      state,
    });
    return `${this.env.auth}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthTokens> {
    if (!this.isConfigured()) throw new NotConfiguredError(this.type);
    const data = await this.http<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }>(this.env.token, {
      method: "POST",
      form: true,
      headers: { Authorization: this.basicAuthHeader() },
      body: {
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.EBAY_RU_NAME ?? process.env.EBAY_REDIRECT_URI!,
      },
    });
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresInSeconds: data.expires_in,
    };
  }

  async refreshAccessToken(channel: ChannelWithConfig): Promise<OAuthTokens> {
    if (!channel.refreshToken) throw new NotConfiguredError(this.type);
    const data = await this.http<{ access_token: string; expires_in: number }>(
      this.env.token,
      {
        method: "POST",
        form: true,
        headers: { Authorization: this.basicAuthHeader() },
        body: {
          grant_type: "refresh_token",
          refresh_token: channel.refreshToken,
          scope: SCOPES.join(" "),
        },
      }
    );
    return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
  }

  // --- Listings --------------------------------------------------------------

  async publishListing(ctx: PublishContext): Promise<PublishResult> {
    const { channel, product, listing } = ctx;
    const sku = product.sku;
    const headers = this.authHeaders(channel);
    const cfg = (channel.config as Record<string, unknown>) ?? {};

    // 1. Create/replace the inventory item (product + on-hand availability).
    await this.http(`${this.env.api}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
      method: "PUT",
      headers,
      body: {
        availability: { shipToLocationAvailability: { quantity: ctx.quantity } },
        condition: "NEW",
        product: {
          title: ctx.title.slice(0, 80),
          description: ctx.description,
          imageUrls: product.images.map((i) => i.url).slice(0, 12),
          aspects: {},
          ...(product.upc ? { upc: [product.upc] } : {}),
          ...(product.mpn ? { mpn: product.mpn } : {}),
          ...(product.brand ? { brand: product.brand } : {}),
        },
      },
    });

    // 2. Create the offer (price, marketplace, business policies).
    const offer = await this.http<{ offerId: string }>(
      `${this.env.api}/sell/inventory/v1/offer`,
      {
        method: "POST",
        headers,
        body: {
          sku,
          marketplaceId: this.marketplaceId,
          format: "FIXED_PRICE",
          availableQuantity: ctx.quantity,
          categoryId: cfg.categoryId ?? "00000",
          merchantLocationKey: cfg.merchantLocationKey ?? "default",
          pricingSummary: {
            price: { value: (ctx.priceCents / 100).toFixed(2), currency: product.currency },
          },
          listingPolicies: cfg.listingPolicies ?? {},
        },
      }
    );

    // 3. Publish the offer to go live and obtain an eBay listing id.
    const published = await this.http<{ listingId: string }>(
      `${this.env.api}/sell/inventory/v1/offer/${offer.offerId}/publish`,
      { method: "POST", headers }
    );

    return {
      externalId: published.listingId,
      externalUrl: `https://www.ebay.com/itm/${published.listingId}`,
    };
  }

  async updateListing(ctx: PublishContext): Promise<PublishResult> {
    // The inventory PUT in publishListing is idempotent (create-or-replace),
    // so re-running it applies catalog + price + quantity updates.
    return this.publishListing(ctx);
  }

  async updateInventory(channel: ChannelWithConfig, listing: Listing, quantity: number): Promise<void> {
    const sku = (listing as Listing & { product?: { sku: string } }).product?.sku;
    // Bulk price/quantity is the lightweight path for stock-only updates.
    await this.http(`${this.env.api}/sell/inventory/v1/bulk_update_price_quantity`, {
      method: "POST",
      headers: this.authHeaders(channel),
      body: {
        requests: [
          {
            sku: sku ?? listing.externalId,
            shipToLocationAvailability: { quantity },
          },
        ],
      },
    });
  }

  async endListing(channel: ChannelWithConfig, listing: Listing): Promise<void> {
    // Withdraw by setting availability to zero (keeps the offer for relist).
    await this.updateInventory(channel, listing, 0);
  }

  // --- Orders ----------------------------------------------------------------

  async fetchOrders(channel: ChannelWithConfig, since: Date): Promise<NormalizedOrder[]> {
    const filter = `creationdate:[${since.toISOString()}..]`;
    const data = await this.http<{ orders?: EbayOrder[] }>(
      this.buildUrl(this.env.api, "/sell/fulfillment/v1/order", { filter, limit: 200 }),
      { headers: this.authHeaders(channel) }
    );
    return (data.orders ?? []).map((o) => this.normalizeOrder(o));
  }

  private normalizeOrder(o: EbayOrder): NormalizedOrder {
    const ship = o.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
    const toCents = (s?: string) => Math.round(parseFloat(s ?? "0") * 100);
    return {
      externalId: o.orderId,
      orderNumber: o.orderId,
      placedAt: new Date(o.creationDate),
      currency: o.pricingSummary?.total?.currency ?? "USD",
      subtotalCents: toCents(o.pricingSummary?.priceSubtotal?.value),
      shippingCents: toCents(o.pricingSummary?.deliveryCost?.value),
      taxCents: toCents(o.pricingSummary?.tax?.value),
      totalCents: toCents(o.pricingSummary?.total?.value),
      buyerName: ship?.fullName,
      buyerEmail: o.buyer?.username,
      ship: {
        name: ship?.fullName,
        address1: ship?.contactAddress?.addressLine1,
        address2: ship?.contactAddress?.addressLine2,
        city: ship?.contactAddress?.city,
        region: ship?.contactAddress?.stateOrProvince,
        postal: ship?.contactAddress?.postalCode,
        country: ship?.contactAddress?.countryCode,
      },
      items: (o.lineItems ?? []).map((li) => ({
        sku: li.sku ?? li.legacyItemId,
        title: li.title,
        quantity: li.quantity,
        priceCents: toCents(li.lineItemCost?.value),
      })),
    };
  }

  async pushFulfillment(
    channel: ChannelWithConfig,
    externalOrderId: string,
    tracking: { carrier: string; trackingNumber: string }
  ): Promise<void> {
    await this.http(
      `${this.env.api}/sell/fulfillment/v1/order/${externalOrderId}/shipping_fulfillment`,
      {
        method: "POST",
        headers: this.authHeaders(channel),
        body: {
          lineItems: [],
          shippedDate: new Date().toISOString(),
          shippingCarrierCode: tracking.carrier,
          trackingNumber: tracking.trackingNumber,
        },
      }
    );
  }
}

// --- eBay response shapes (partial) ----------------------------------------
interface EbayOrder {
  orderId: string;
  creationDate: string;
  buyer?: { username?: string };
  pricingSummary?: {
    priceSubtotal?: { value?: string };
    deliveryCost?: { value?: string };
    tax?: { value?: string };
    total?: { value?: string; currency?: string };
  };
  fulfillmentStartInstructions?: {
    shippingStep?: {
      shipTo?: {
        fullName?: string;
        contactAddress?: {
          addressLine1?: string;
          addressLine2?: string;
          city?: string;
          stateOrProvince?: string;
          postalCode?: string;
          countryCode?: string;
        };
      };
    };
  }[];
  lineItems?: {
    sku?: string;
    legacyItemId: string;
    title: string;
    quantity: number;
    lineItemCost?: { value?: string };
  }[];
}
