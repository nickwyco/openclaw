import type { Channel, ChannelType, Product, ProductImage, Listing } from "@prisma/client";

// ---------------------------------------------------------------------------
// Shared types passed in and out of every channel adapter.
// ---------------------------------------------------------------------------

export type ChannelWithConfig = Channel;

export type ProductForListing = Product & { images: ProductImage[] };

export interface PublishContext {
  channel: ChannelWithConfig;
  product: ProductForListing;
  listing: Listing;
  // Resolved values the engine computes (price after markup, available qty).
  priceCents: number;
  quantity: number;
  title: string;
  description: string;
}

export interface PublishResult {
  externalId: string;
  externalUrl?: string;
}

export interface NormalizedOrder {
  externalId: string;
  orderNumber: string;
  placedAt: Date;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  buyerName?: string;
  buyerEmail?: string;
  ship?: {
    name?: string;
    address1?: string;
    address2?: string;
    city?: string;
    region?: string;
    postal?: string;
    country?: string;
  };
  items: {
    sku: string;
    title: string;
    quantity: number;
    priceCents: number;
  }[];
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds?: number;
  externalId?: string;
  shopDomain?: string;
}

// Thrown when the app itself has no API keys for a marketplace. The engine
// catches this and records a SKIPPED sync rather than a failure.
export class NotConfiguredError extends Error {
  constructor(public channelType: ChannelType) {
    super(`No application credentials configured for ${channelType}`);
    this.name = "NotConfiguredError";
  }
}

// Thrown when a specific Channel has not completed OAuth / has no token.
export class NotConnectedError extends Error {
  constructor(public channelType: ChannelType) {
    super(`Channel ${channelType} is not connected (no access token)`);
    this.name = "NotConnectedError";
  }
}

// The contract every marketplace integration implements.
export interface ChannelAdapter {
  readonly type: ChannelType;

  // True when the application has the API keys needed to talk to this market.
  isConfigured(): boolean;

  // --- OAuth ---
  getAuthorizationUrl(state: string, channel?: ChannelWithConfig): string;
  exchangeCode(code: string, channel?: ChannelWithConfig): Promise<OAuthTokens>;
  refreshAccessToken?(channel: ChannelWithConfig): Promise<OAuthTokens>;

  // --- Catalog / listings ---
  publishListing(ctx: PublishContext): Promise<PublishResult>;
  updateListing(ctx: PublishContext): Promise<PublishResult>;
  updateInventory(channel: ChannelWithConfig, listing: Listing, quantity: number): Promise<void>;
  endListing(channel: ChannelWithConfig, listing: Listing): Promise<void>;

  // --- Orders ---
  fetchOrders(channel: ChannelWithConfig, since: Date): Promise<NormalizedOrder[]>;
  pushFulfillment(
    channel: ChannelWithConfig,
    externalOrderId: string,
    tracking: { carrier: string; trackingNumber: string }
  ): Promise<void>;
}
