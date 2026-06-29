import type { ChannelType } from "@prisma/client";
import { AmazonAdapter } from "./amazon";
import { EbayAdapter } from "./ebay";
import { EtsyAdapter } from "./etsy";
import { ShopifyAdapter } from "./shopify";
import { WalmartAdapter } from "./walmart";
import type { ChannelAdapter } from "./types";

const ADAPTERS: Record<ChannelType, ChannelAdapter> = {
  EBAY: new EbayAdapter(),
  ETSY: new EtsyAdapter(),
  SHOPIFY: new ShopifyAdapter(),
  AMAZON: new AmazonAdapter(),
  WALMART: new WalmartAdapter(),
};

export function getAdapter(type: ChannelType): ChannelAdapter {
  return ADAPTERS[type];
}

export interface ChannelTypeInfo {
  type: ChannelType;
  label: string;
  configured: boolean;
  // Priority channels (the ones we actively sell on) surface first in the UI.
  priority: boolean;
  docsUrl: string;
}

const META: Record<ChannelType, { label: string; priority: boolean; docsUrl: string }> = {
  EBAY: { label: "eBay", priority: true, docsUrl: "https://developer.ebay.com" },
  ETSY: { label: "Etsy", priority: true, docsUrl: "https://developers.etsy.com" },
  SHOPIFY: { label: "Shopify", priority: true, docsUrl: "https://shopify.dev" },
  AMAZON: { label: "Amazon", priority: false, docsUrl: "https://developer-docs.amazon.com/sp-api" },
  WALMART: { label: "Walmart", priority: false, docsUrl: "https://developer.walmart.com" },
};

export function listChannelTypes(): ChannelTypeInfo[] {
  return (Object.keys(ADAPTERS) as ChannelType[])
    .map((type) => ({
      type,
      label: META[type].label,
      configured: ADAPTERS[type].isConfigured(),
      priority: META[type].priority,
      docsUrl: META[type].docsUrl,
    }))
    .sort((a, b) => Number(b.priority) - Number(a.priority) || a.label.localeCompare(b.label));
}

export function channelLabel(type: ChannelType): string {
  return META[type].label;
}
