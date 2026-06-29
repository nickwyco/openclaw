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

// Walmart Marketplace API (secondary). Uses client-credentials OAuth to mint a
// short-lived access token. Items, inventory, and orders each have their own
// endpoints. Docs: https://developer.walmart.com/
const API = "https://marketplace.walmartapis.com";

export class WalmartAdapter extends BaseAdapter implements ChannelAdapter {
  readonly type: ChannelType = "WALMART";

  isConfigured(): boolean {
    return Boolean(process.env.WALMART_CLIENT_ID && process.env.WALMART_CLIENT_SECRET);
  }

  // Walmart has no interactive consent screen — it's pure client credentials.
  getAuthorizationUrl(): string {
    if (!this.isConfigured()) throw new NotConfiguredError(this.type);
    return `${process.env.APP_URL ?? ""}/channels`;
  }

  async exchangeCode(): Promise<OAuthTokens> {
    return this.clientCredentials();
  }

  async refreshAccessToken(): Promise<OAuthTokens> {
    return this.clientCredentials();
  }

  private async clientCredentials(): Promise<OAuthTokens> {
    if (!this.isConfigured()) throw new NotConfiguredError(this.type);
    const basic = Buffer.from(`${process.env.WALMART_CLIENT_ID}:${process.env.WALMART_CLIENT_SECRET}`).toString("base64");
    const data = await this.http<{ access_token: string; expires_in: number }>(
      `${API}/v3/token`,
      {
        method: "POST",
        form: true,
        headers: { Authorization: `Basic ${basic}`, "WM_SVC.NAME": "Walmart Marketplace", Accept: "application/json" },
        body: { grant_type: "client_credentials" },
      }
    );
    return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
  }

  private headers(channel: ChannelWithConfig) {
    return {
      "WM_SEC.ACCESS_TOKEN": this.requireToken(channel),
      "WM_SVC.NAME": "Walmart Marketplace",
      "WM_QOS.CORRELATION_ID": channel.id,
      Accept: "application/json",
    };
  }

  async publishListing(ctx: PublishContext): Promise<PublishResult> {
    const { channel, product } = ctx;
    await this.http(`${API}/v3/items`, {
      method: "POST",
      headers: this.headers(channel),
      body: {
        MPItemFeedHeader: { sellingChannel: "marketplace", version: "4.2" },
        MPItem: [
          {
            Orderable: {
              sku: product.sku,
              productIdentifiers: product.upc
                ? { productIdType: "UPC", productId: product.upc }
                : undefined,
              productName: ctx.title,
              price: ctx.priceCents / 100,
            },
          },
        ],
      },
    });
    return { externalId: product.sku };
  }

  async updateListing(ctx: PublishContext): Promise<PublishResult> {
    return this.publishListing(ctx);
  }

  async updateInventory(channel: ChannelWithConfig, listing: Listing, quantity: number): Promise<void> {
    const sku = listing.externalId ?? "";
    await this.http(this.buildUrl(API, `/v3/inventory`, { sku }), {
      method: "PUT",
      headers: this.headers(channel),
      body: { sku, quantity: { unit: "EACH", amount: quantity } },
    });
  }

  async endListing(channel: ChannelWithConfig, listing: Listing): Promise<void> {
    await this.updateInventory(channel, listing, 0);
  }

  async fetchOrders(channel: ChannelWithConfig, since: Date): Promise<NormalizedOrder[]> {
    const data = await this.http<{ list?: { elements?: { order?: WalmartOrder[] } } }>(
      this.buildUrl(API, "/v3/orders", { createdStartDate: since.toISOString() }),
      { headers: this.headers(channel) }
    );
    return (data.list?.elements?.order ?? []).map((o) => this.normalize(o));
  }

  private normalize(o: WalmartOrder): NormalizedOrder {
    const lines = o.orderLines?.orderLine ?? [];
    const cents = (n?: number) => Math.round((n ?? 0) * 100);
    return {
      externalId: o.purchaseOrderId,
      orderNumber: o.customerOrderId ?? o.purchaseOrderId,
      placedAt: new Date(o.orderDate),
      currency: "USD",
      subtotalCents: 0,
      shippingCents: 0,
      taxCents: 0,
      totalCents: lines.reduce((s, l) => s + cents(l.charges?.charge?.[0]?.chargeAmount?.amount), 0),
      buyerName: o.shippingInfo?.postalAddress?.name,
      ship: {
        name: o.shippingInfo?.postalAddress?.name,
        address1: o.shippingInfo?.postalAddress?.address1,
        city: o.shippingInfo?.postalAddress?.city,
        region: o.shippingInfo?.postalAddress?.state,
        postal: o.shippingInfo?.postalAddress?.postalCode,
        country: o.shippingInfo?.postalAddress?.country,
      },
      items: lines.map((l) => ({
        sku: l.item?.sku ?? "",
        title: l.item?.productName ?? "",
        quantity: Number(l.orderLineQuantity?.amount ?? 1),
        priceCents: cents(l.charges?.charge?.[0]?.chargeAmount?.amount),
      })),
    };
  }

  async pushFulfillment(
    channel: ChannelWithConfig,
    externalOrderId: string,
    tracking: { carrier: string; trackingNumber: string }
  ): Promise<void> {
    await this.http(`${API}/v3/orders/${externalOrderId}/shipping`, {
      method: "POST",
      headers: this.headers(channel),
      body: {
        orderShipment: {
          orderLines: {
            orderLine: [
              {
                trackingInfo: {
                  carrierName: { carrier: tracking.carrier },
                  trackingNumber: tracking.trackingNumber,
                },
              },
            ],
          },
        },
      },
    });
  }
}

interface WalmartOrder {
  purchaseOrderId: string;
  customerOrderId?: string;
  orderDate: string;
  shippingInfo?: {
    postalAddress?: {
      name?: string;
      address1?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
  orderLines?: {
    orderLine?: {
      item?: { sku?: string; productName?: string };
      orderLineQuantity?: { amount?: string };
      charges?: { charge?: { chargeAmount?: { amount?: number } }[] };
    }[];
  };
}
