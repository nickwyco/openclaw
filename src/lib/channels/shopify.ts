import type { ChannelType, Listing } from "@prisma/client";
import { BaseAdapter } from "./base";
import {
  NotConfiguredError,
  NotConnectedError,
  type ChannelAdapter,
  type ChannelWithConfig,
  type NormalizedOrder,
  type OAuthTokens,
  type PublishContext,
  type PublishResult,
} from "./types";

// Shopify Admin API (REST). Per-store OAuth; the access token is sent in the
// X-Shopify-Access-Token header and is scoped to a single myshopify.com domain.
// Docs: https://shopify.dev/docs/api/admin-rest
export class ShopifyAdapter extends BaseAdapter implements ChannelAdapter {
  readonly type: ChannelType = "SHOPIFY";

  private get version() {
    return process.env.SHOPIFY_API_VERSION ?? "2024-10";
  }

  isConfigured(): boolean {
    return Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);
  }

  private base(channel: ChannelWithConfig): string {
    if (!channel.shopDomain) throw new NotConnectedError(this.type);
    return `https://${channel.shopDomain}/admin/api/${this.version}`;
  }

  private headers(channel: ChannelWithConfig) {
    return { "X-Shopify-Access-Token": this.requireToken(channel) };
  }

  private locationId(channel: ChannelWithConfig): string | undefined {
    const cfg = (channel.config as Record<string, unknown>) ?? {};
    return cfg.locationId ? String(cfg.locationId) : undefined;
  }

  // --- OAuth -----------------------------------------------------------------

  getAuthorizationUrl(state: string, channel?: ChannelWithConfig): string {
    if (!this.isConfigured()) throw new NotConfiguredError(this.type);
    const shop = channel?.shopDomain;
    if (!shop) throw new Error("Shopify shop domain is required to start OAuth");
    const params = new URLSearchParams({
      client_id: process.env.SHOPIFY_API_KEY!,
      scope: process.env.SHOPIFY_SCOPES ?? "read_products,write_products,read_orders,write_inventory",
      redirect_uri: process.env.SHOPIFY_REDIRECT_URI!,
      state,
    });
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, channel?: ChannelWithConfig): Promise<OAuthTokens> {
    if (!this.isConfigured()) throw new NotConfiguredError(this.type);
    const shop = channel?.shopDomain;
    if (!shop) throw new Error("Shopify shop domain is required for token exchange");
    const data = await this.http<{ access_token: string; scope: string }>(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        body: {
          client_id: process.env.SHOPIFY_API_KEY,
          client_secret: process.env.SHOPIFY_API_SECRET,
          code,
        },
      }
    );
    return { accessToken: data.access_token, shopDomain: shop, externalId: shop };
  }

  // --- Listings (Shopify products) ------------------------------------------

  async publishListing(ctx: PublishContext): Promise<PublishResult> {
    const { channel, product } = ctx;
    const created = await this.http<{ product: ShopifyProduct }>(
      `${this.base(channel)}/products.json`,
      {
        method: "POST",
        headers: this.headers(channel),
        body: {
          product: {
            title: ctx.title,
            body_html: ctx.description,
            vendor: product.brand ?? undefined,
            status: "active",
            images: product.images.map((i) => ({ src: i.url })),
            variants: [
              {
                sku: product.sku,
                price: (ctx.priceCents / 100).toFixed(2),
                barcode: product.upc ?? product.ean ?? undefined,
                inventory_management: "shopify",
                inventory_quantity: ctx.quantity,
                weight_unit: "g",
                grams: product.weightGrams ?? 0,
              },
            ],
          },
        },
      }
    );
    return {
      externalId: String(created.product.id),
      externalUrl: `https://${channel.shopDomain}/products/${created.product.handle}`,
    };
  }

  async updateListing(ctx: PublishContext): Promise<PublishResult> {
    const { channel, listing } = ctx;
    await this.http(`${this.base(channel)}/products/${listing.externalId}.json`, {
      method: "PUT",
      headers: this.headers(channel),
      body: {
        product: {
          id: Number(listing.externalId),
          title: ctx.title,
          body_html: ctx.description,
        },
      },
    });
    await this.updateInventory(channel, listing, ctx.quantity);
    return { externalId: listing.externalId ?? "", externalUrl: listing.externalUrl ?? undefined };
  }

  async updateInventory(channel: ChannelWithConfig, listing: Listing, quantity: number): Promise<void> {
    const locationId = this.locationId(channel);
    if (!locationId) throw new Error("Shopify channel has no location configured");

    // Find the variant's inventory_item_id, then set the absolute level.
    const prod = await this.http<{ product: ShopifyProduct }>(
      `${this.base(channel)}/products/${listing.externalId}.json`,
      { headers: this.headers(channel) }
    );
    const inventoryItemId = prod.product.variants?.[0]?.inventory_item_id;
    if (!inventoryItemId) return;

    await this.http(`${this.base(channel)}/inventory_levels/set.json`, {
      method: "POST",
      headers: this.headers(channel),
      body: { location_id: Number(locationId), inventory_item_id: inventoryItemId, available: quantity },
    });
  }

  async endListing(channel: ChannelWithConfig, listing: Listing): Promise<void> {
    await this.http(`${this.base(channel)}/products/${listing.externalId}.json`, {
      method: "PUT",
      headers: this.headers(channel),
      body: { product: { id: Number(listing.externalId), status: "archived" } },
    });
  }

  // --- Orders ----------------------------------------------------------------

  async fetchOrders(channel: ChannelWithConfig, since: Date): Promise<NormalizedOrder[]> {
    const data = await this.http<{ orders?: ShopifyOrder[] }>(
      this.buildUrl(this.base(channel), "/orders.json", {
        status: "any",
        created_at_min: since.toISOString(),
        limit: 250,
      }),
      { headers: this.headers(channel) }
    );
    return (data.orders ?? []).map((o) => this.normalizeOrder(o));
  }

  private normalizeOrder(o: ShopifyOrder): NormalizedOrder {
    const cents = (s?: string) => Math.round(parseFloat(s ?? "0") * 100);
    const ship = o.shipping_address;
    return {
      externalId: String(o.id),
      orderNumber: o.name,
      placedAt: new Date(o.created_at),
      currency: o.currency ?? "USD",
      subtotalCents: cents(o.subtotal_price),
      shippingCents: cents(o.total_shipping_price_set?.shop_money?.amount),
      taxCents: cents(o.total_tax),
      totalCents: cents(o.total_price),
      buyerName: o.customer ? `${o.customer.first_name ?? ""} ${o.customer.last_name ?? ""}`.trim() : ship?.name,
      buyerEmail: o.email ?? undefined,
      ship: ship
        ? {
            name: ship.name,
            address1: ship.address1,
            address2: ship.address2 ?? undefined,
            city: ship.city,
            region: ship.province,
            postal: ship.zip,
            country: ship.country_code,
          }
        : undefined,
      items: (o.line_items ?? []).map((li) => ({
        sku: li.sku ?? String(li.product_id ?? ""),
        title: li.title,
        quantity: li.quantity,
        priceCents: cents(li.price),
      })),
    };
  }

  async pushFulfillment(
    channel: ChannelWithConfig,
    externalOrderId: string,
    tracking: { carrier: string; trackingNumber: string }
  ): Promise<void> {
    // Modern Shopify fulfillment requires a fulfillment order id; we look it up
    // then create a fulfillment that carries the tracking info.
    const fo = await this.http<{ fulfillment_orders?: { id: number }[] }>(
      `${this.base(channel)}/orders/${externalOrderId}/fulfillment_orders.json`,
      { headers: this.headers(channel) }
    );
    const fulfillmentOrderId = fo.fulfillment_orders?.[0]?.id;
    if (!fulfillmentOrderId) return;

    await this.http(`${this.base(channel)}/fulfillments.json`, {
      method: "POST",
      headers: this.headers(channel),
      body: {
        fulfillment: {
          line_items_by_fulfillment_order: [{ fulfillment_order_id: fulfillmentOrderId }],
          tracking_info: { number: tracking.trackingNumber, company: tracking.carrier },
          notify_customer: true,
        },
      },
    });
  }
}

// --- Shopify response shapes (partial) -------------------------------------
interface ShopifyProduct {
  id: number;
  handle: string;
  variants?: { id: number; inventory_item_id: number }[];
}
interface ShopifyOrder {
  id: number;
  name: string;
  email?: string | null;
  currency?: string;
  created_at: string;
  subtotal_price?: string;
  total_tax?: string;
  total_price?: string;
  total_shipping_price_set?: { shop_money?: { amount?: string } };
  customer?: { first_name?: string; last_name?: string };
  shipping_address?: {
    name?: string;
    address1?: string;
    address2?: string | null;
    city?: string;
    province?: string;
    zip?: string;
    country_code?: string;
  };
  line_items?: { sku?: string; product_id?: number; title: string; quantity: number; price?: string }[];
}
