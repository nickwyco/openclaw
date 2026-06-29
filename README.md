# OpenClaw

An open, self-hostable **multi-channel e-commerce hub** in the spirit of Sellbrite.
Manage one product catalog, keep inventory in sync across every marketplace, and
handle all your orders from a single inbox.

> **Priority channels:** eBay, Etsy, and Shopify are fully wired with real API
> scaffolding. Amazon (SP-API) and Walmart Marketplace are included behind the
> same adapter interface.

## What it does

| Area | Features |
| --- | --- |
| **Catalog** | Products with SKUs, identifiers (UPC/EAN/MPN/GTIN), pricing, cost, weight/dimensions, images, variants, conditions. Search, create, edit, archive, CSV-style bulk listing. |
| **Inventory** | Multi-warehouse stock as the single source of truth. On-hand / reserved / available accounting, reorder points, low-stock alerts, an append-only movement ledger, and instant quick-adjust. |
| **Listings** | Publish a product to any channel, channel-specific price overrides & markups, bulk "list & publish", re-sync, and end-listing. Per-listing live status and error surfacing. |
| **Channels** | OAuth connect flows (eBay, Etsy PKCE, Shopify, Amazon LWA, Walmart client-credentials), markup rules, auto-sync toggles, and an integration-status panel. |
| **Orders** | Unified order inbox imported from every channel, SKU matching back to the catalog, automatic inventory reservation, fulfillment with tracking pushed back to the marketplace. |
| **Reports** | Revenue trend, revenue by channel, channel share, top products, inventory valuation. |
| **Sync engine** | Inventory changes fan out to all active listings (oversell protection). Every push/pull is recorded in a sync activity log. A background worker reconciles on an interval. |

## Architecture

```
Next.js 14 (App Router, TypeScript)
├─ src/app/**            UI pages (server components) + /api route handlers
├─ src/components/**     Client components (tables, modals, charts)
├─ src/lib/
│  ├─ channels/         Marketplace adapters behind one ChannelAdapter interface
│  │   ├─ types.ts      The adapter contract + DTOs
│  │   ├─ base.ts       Shared fetch/error/encoding helpers
│  │   ├─ ebay.ts  etsy.ts  shopify.ts        ← priority, full scaffolding
│  │   ├─ amazon.ts  walmart.ts               ← secondary
│  │   └─ registry.ts   type → adapter lookup
│  ├─ sync/             engine.ts (publish, inventory push, order import,
│  │                    fulfillment), oauth.ts (token persistence/refresh)
│  ├─ jobs/worker.ts    standalone interval worker
│  ├─ reports.ts        dashboard + analytics read models
│  └─ prisma.ts, money.ts, inventory.ts, account.ts
└─ prisma/schema.prisma + seed.ts   PostgreSQL data model + demo data
```

**Graceful degradation:** the app runs with **no marketplace credentials**.
Adapters throw a typed `NotConfiguredError` / `NotConnectedError`, the sync
engine records those as `SKIPPED` (not failures), and the UI + seeded demo data
work end-to-end so you can explore everything offline.

## Quick start

```bash
# 1. Install
npm install

# 2. Database (PostgreSQL via docker, or point DATABASE_URL at your own)
docker compose up -d
cp .env.example .env

# 3. Schema + demo data
npm run db:push
npm run db:seed

# 4. Run
npm run dev          # http://localhost:3000

# Optional: background sync worker (token refresh, order import, inventory)
npm run sync:worker
```

## Connecting a real marketplace

1. Create developer apps on the marketplaces you use and copy their
   credentials into `.env` (see `.env.example` for the exact variable names).
2. Set every app's OAuth redirect URL to `${APP_URL}/api/oauth/callback`.
3. In the app, go to **Channels → Add channel**, then **Connect** to run OAuth.
4. Select products and **List & publish**, or open a product and list it per
   channel. Inventory edits then sync outward automatically.

### Credential variables

| Channel | Variables |
| --- | --- |
| eBay | `EBAY_ENV`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_RU_NAME` |
| Etsy | `ETSY_KEYSTRING`, `ETSY_SHARED_SECRET` |
| Shopify | `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES` |
| Amazon | `AMAZON_LWA_CLIENT_ID`, `AMAZON_LWA_CLIENT_SECRET`, `AMAZON_REFRESH_TOKEN` |
| Walmart | `WALMART_CLIENT_ID`, `WALMART_CLIENT_SECRET` |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build & serve |
| `npm run db:push` | Apply the Prisma schema to the database |
| `npm run db:seed` | Load demo account, products, channels, orders |
| `npm run db:studio` | Open Prisma Studio |
| `npm run sync:worker` | Run the background sync worker |
| `npm run typecheck` | Type-check the project |

## Notes & next steps

This is a single-tenant build (`currentAccountId()` resolves the one seeded
account). Production hardening would add: authentication/sessions, per-account
scoping, encryption of stored OAuth tokens, marketplace webhooks for real-time
order/inventory events, a durable job queue, and listing-template UIs. The data
model and adapter layer are already shaped for all of these.
