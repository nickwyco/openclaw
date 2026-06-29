"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui";

export interface ListingRow {
  id: string;
  productId: string;
  productTitle: string;
  sku: string;
  image: string | null;
  channel: string;
  status: string;
  priceCents: number;
  publishedQty: number;
  externalUrl: string | null;
  lastError: string | null;
}

const FILTERS = ["ALL", "DRAFT", "ACTIVE", "ERROR", "INACTIVE"] as const;

export function ListingsClient({ rows }: { rows: ListingRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action?: "end") {
    setBusy(id);
    await fetch(`/api/listings/${id}/publish${action ? `?action=${action}` : ""}`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  async function publishAllDrafts() {
    const drafts = rows.filter((r) => r.status === "DRAFT");
    setBusy("__bulk__");
    for (const d of drafts) {
      await fetch(`/api/listings/${d.id}/publish`, { method: "POST" });
    }
    setBusy(null);
    router.refresh();
  }

  const visible = filter === "ALL" ? rows : rows.filter((r) => r.status === filter);
  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === "ALL" ? rows.length : rows.filter((r) => r.status === f).length]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`badge ${filter === f ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {f.toLowerCase()} ({counts[f]})
          </button>
        ))}
        <button className="btn-primary ml-auto h-8" disabled={busy === "__bulk__" || counts.DRAFT === 0} onClick={publishAllDrafts}>
          Publish all drafts ({counts.DRAFT})
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="th">Product</th>
              <th className="th">Channel</th>
              <th className="th text-right">Price</th>
              <th className="th text-right">Qty</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visible.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="td">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={l.image ?? "https://placehold.co/36x36/eef/99a?text=%20"}
                      alt=""
                      className="h-9 w-9 rounded border border-slate-200 object-cover"
                    />
                    <div>
                      <Link href={`/products/${l.productId}`} className="font-medium text-slate-800 hover:text-brand-600">
                        {l.productTitle}
                      </Link>
                      <div className="font-mono text-xs text-slate-400">{l.sku}</div>
                    </div>
                  </div>
                </td>
                <td className="td">{l.channel}</td>
                <td className="td text-right">{formatMoney(l.priceCents)}</td>
                <td className="td text-right">{l.publishedQty}</td>
                <td className="td">
                  <StatusBadge status={l.status} />
                  {l.lastError && <div className="max-w-[220px] truncate text-xs text-red-500">{l.lastError}</div>}
                </td>
                <td className="td text-right">
                  <div className="flex justify-end gap-2">
                    {l.externalUrl && (
                      <a href={l.externalUrl} target="_blank" className="btn-ghost h-7">
                        View
                      </a>
                    )}
                    <button className="btn-ghost h-7" disabled={busy === l.id} onClick={() => act(l.id)}>
                      {l.status === "ACTIVE" ? "Re-sync" : "Publish"}
                    </button>
                    {l.status === "ACTIVE" && (
                      <button className="btn-danger h-7" disabled={busy === l.id} onClick={() => act(l.id, "end")}>
                        End
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="td py-10 text-center text-slate-400">
                  No listings in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
