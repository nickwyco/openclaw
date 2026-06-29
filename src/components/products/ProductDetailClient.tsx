"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui";

interface InventoryRow {
  id: string;
  warehouse: string;
  onHand: number;
  reserved: number;
  available: number;
}
interface ListingRow {
  id: string;
  channelId: string;
  channel: string;
  status: string;
  externalUrl: string | null;
  priceCents: number | null;
  publishedQty: number;
  lastError: string | null;
}
interface ChannelOpt {
  id: string;
  name: string;
  alreadyListed: boolean;
}

export function ProductDetailClient({
  productId,
  priceCents,
  currency,
  inventory,
  listings,
  channels,
}: {
  productId: string;
  priceCents: number;
  currency: string;
  inventory: InventoryRow[];
  listings: ListingRow[];
  channels: ChannelOpt[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function adjust(warehouseId: string, delta: number) {
    setBusy(warehouseId);
    await fetch("/api/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, delta, reason: delta > 0 ? "PURCHASE_RECEIVED" : "ADJUSTMENT" }),
    });
    setBusy(null);
    router.refresh();
  }

  async function setStock(warehouseId: string, value: number) {
    setBusy(warehouseId);
    await fetch("/api/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, warehouseId, setOnHand: value, reason: "RECOUNT" }),
    });
    setBusy(null);
    router.refresh();
  }

  async function createListing(channelId: string, publishNow: boolean) {
    setBusy(channelId);
    await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, channelId, publishNow }),
    });
    setBusy(null);
    router.refresh();
  }

  async function publish(listingId: string, action?: "end") {
    setBusy(listingId);
    await fetch(`/api/listings/${listingId}/publish${action ? `?action=${action}` : ""}`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  const unlisted = channels.filter((c) => !c.alreadyListed);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Inventory */}
      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Inventory by warehouse</h2>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Warehouse</th>
              <th className="th text-right">On hand</th>
              <th className="th text-right">Reserved</th>
              <th className="th text-right">Available</th>
              <th className="th text-right">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {inventory.map((row) => (
              <tr key={row.id}>
                <td className="td">{row.warehouse}</td>
                <td className="td text-right">{row.onHand}</td>
                <td className="td text-right text-amber-600">{row.reserved}</td>
                <td className="td text-right font-semibold">{row.available}</td>
                <td className="td">
                  <div className="flex items-center justify-end gap-1">
                    <button className="btn-ghost h-7 px-2" disabled={busy === row.id} onClick={() => adjust(row.id, -1)}>
                      −
                    </button>
                    <input
                      type="number"
                      defaultValue={row.onHand}
                      className="input h-7 w-16 text-right"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== row.onHand) setStock(row.id, v);
                      }}
                    />
                    <button className="btn-ghost h-7 px-2" disabled={busy === row.id} onClick={() => adjust(row.id, 1)}>
                      +
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {inventory.length === 0 && (
              <tr>
                <td colSpan={5} className="td text-center text-slate-400">
                  No inventory rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Listings */}
      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-700">Channel listings</h2>
        </div>
        <ul className="divide-y divide-slate-50">
          {listings.map((l) => (
            <li key={l.id} className="px-5 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{l.channel}</span>
                    <StatusBadge status={l.status} />
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatMoney(l.priceCents ?? priceCents, currency)} · qty {l.publishedQty}
                    {l.externalUrl && (
                      <>
                        {" · "}
                        <a href={l.externalUrl} target="_blank" className="text-brand-600 hover:underline">
                          view
                        </a>
                      </>
                    )}
                  </div>
                  {l.lastError && <div className="mt-1 text-xs text-red-500">{l.lastError}</div>}
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost h-8" disabled={busy === l.id} onClick={() => publish(l.id)}>
                    {l.status === "ACTIVE" ? "Re-sync" : "Publish"}
                  </button>
                  {l.status === "ACTIVE" && (
                    <button className="btn-danger h-8" disabled={busy === l.id} onClick={() => publish(l.id, "end")}>
                      End
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
          {listings.length === 0 && (
            <li className="px-5 py-4 text-sm text-slate-400">Not listed anywhere yet.</li>
          )}
        </ul>

        {unlisted.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3">
            <div className="label">List on another channel</div>
            <div className="flex flex-wrap gap-2">
              {unlisted.map((c) => (
                <button
                  key={c.id}
                  className="btn-ghost h-8"
                  disabled={busy === c.id}
                  onClick={() => createListing(c.id, true)}
                >
                  + {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
