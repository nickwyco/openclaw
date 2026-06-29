"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export interface InvRow {
  productId: string;
  sku: string;
  title: string;
  warehouse: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  low: boolean;
}

export function InventoryClient({ rows }: { rows: InvRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [onlyLow, setOnlyLow] = useState(false);

  async function setStock(productId: string, value: number) {
    setBusy(productId);
    await fetch("/api/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, setOnHand: value, reason: "RECOUNT" }),
    });
    setBusy(null);
    router.refresh();
  }

  const visible = onlyLow ? rows.filter((r) => r.low) : rows;

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
        Show only low / out of stock
      </label>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="th">Product</th>
              <th className="th">Warehouse</th>
              <th className="th text-right">On hand</th>
              <th className="th text-right">Reserved</th>
              <th className="th text-right">Available</th>
              <th className="th text-right">Reorder pt</th>
              <th className="th text-right">Set on-hand</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visible.map((r) => (
              <tr key={`${r.productId}-${r.warehouse}`} className={r.low ? "bg-red-50/40" : "hover:bg-slate-50"}>
                <td className="td">
                  <Link href={`/products/${r.productId}`} className="font-medium text-slate-800 hover:text-brand-600">
                    {r.title}
                  </Link>
                  <div className="font-mono text-xs text-slate-400">{r.sku}</div>
                </td>
                <td className="td">{r.warehouse}</td>
                <td className="td text-right">{r.onHand}</td>
                <td className="td text-right text-amber-600">{r.reserved}</td>
                <td className="td text-right font-semibold">
                  {r.low && <AlertTriangle size={14} className="mr-1 inline text-red-500" />}
                  <span className={r.available <= 0 ? "text-red-600" : ""}>{r.available}</span>
                </td>
                <td className="td text-right text-slate-400">{r.reorderPoint || "—"}</td>
                <td className="td text-right">
                  <input
                    type="number"
                    defaultValue={r.onHand}
                    disabled={busy === r.productId}
                    className="input h-8 w-20 text-right"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== r.onHand) setStock(r.productId, v);
                    }}
                  />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="td py-10 text-center text-slate-400">
                  Nothing to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Editing on-hand instantly recomputes available stock and pushes the new quantity to every active listing.
      </p>
    </div>
  );
}
