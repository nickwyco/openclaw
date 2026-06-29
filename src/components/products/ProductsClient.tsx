"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Trash2, Tag } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { StatusBadge } from "@/components/ui";

export interface ProductRow {
  id: string;
  sku: string;
  title: string;
  brand: string | null;
  priceCents: number;
  currency: string;
  status: string;
  image: string | null;
  available: number;
  listingCount: number;
  activeListings: number;
}

export interface ChannelOption {
  id: string;
  name: string;
}

export function ProductsClient({
  initial,
  channels,
}: {
  initial: ProductRow[];
  channels: ChannelOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  async function search(value: string) {
    setQ(value);
    const res = await fetch(`/api/products?q=${encodeURIComponent(value)}`);
    if (res.ok) setRows(await res.json());
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkList(channelIds: string[], publishNow: boolean) {
    await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: [...selected], channelIds, publishNow }),
    });
    setSelected(new Set());
    startTransition(() => router.refresh());
    await search(q);
  }

  async function remove(id: string) {
    if (!confirm("Archive this product? It will be removed from listings views.")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    setRows((r) => r.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by title or SKU…"
            value={q}
            onChange={(e) => search(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add product
        </button>
      </div>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          channels={channels}
          onList={bulkList}
          onClear={() => setSelected(new Set())}
          pending={pending}
        />
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="th w-10"></th>
              <th className="th">Product</th>
              <th className="th">SKU</th>
              <th className="th text-right">Price</th>
              <th className="th text-right">Available</th>
              <th className="th">Listings</th>
              <th className="th">Status</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="td py-10 text-center text-slate-400">
                  No products. Add one or run the seed script.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="td">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                </td>
                <td className="td">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.image ?? "https://placehold.co/40x40/eef/99a?text=%20"}
                      alt=""
                      className="h-10 w-10 rounded-md border border-slate-200 object-cover"
                    />
                    <Link href={`/products/${p.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                      {p.title}
                    </Link>
                  </div>
                </td>
                <td className="td font-mono text-xs text-slate-500">{p.sku}</td>
                <td className="td text-right">{formatMoney(p.priceCents, p.currency)}</td>
                <td className="td text-right">
                  <span className={p.available <= 0 ? "font-semibold text-red-600" : ""}>{p.available}</span>
                </td>
                <td className="td">
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Tag size={14} /> {p.activeListings}/{p.listingCount}
                  </span>
                </td>
                <td className="td"><StatusBadge status={p.status} /></td>
                <td className="td text-right">
                  <button className="text-slate-400 hover:text-red-600" onClick={() => remove(p.id)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <AddProductModal onClose={() => setShowAdd(false)} onCreated={() => search(q)} />}
    </div>
  );
}

function BulkBar({
  count,
  channels,
  onList,
  onClear,
  pending,
}: {
  count: number;
  channels: ChannelOption[];
  onList: (channelIds: string[], publishNow: boolean) => void;
  onClear: () => void;
  pending: boolean;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
      <span className="text-sm font-medium text-brand-800">{count} selected</span>
      <select
        multiple
        className="input h-9 max-w-xs"
        value={picked}
        onChange={(e) => setPicked([...e.target.selectedOptions].map((o) => o.value))}
      >
        {channels.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        className="btn-ghost"
        disabled={picked.length === 0 || pending}
        onClick={() => onList(picked, false)}
      >
        Create drafts
      </button>
      <button
        className="btn-primary"
        disabled={picked.length === 0 || pending}
        onClick={() => onList(picked, true)}
      >
        List &amp; publish
      </button>
      <button className="ml-auto text-sm text-slate-500 hover:underline" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

function AddProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    sku: "",
    title: "",
    brand: "",
    price: "",
    cost: "",
    upc: "",
    initialQty: "0",
    imageUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: form.sku,
        title: form.title,
        brand: form.brand || undefined,
        price: form.price || 0,
        cost: form.cost || 0,
        upc: form.upc || undefined,
        initialQty: Number(form.initialQty) || 0,
        imageUrl: form.imageUrl || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to create product");
      return;
    }
    onCreated();
    onClose();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="card w-full max-w-lg p-6">
        <h3 className="text-lg font-bold text-slate-900">Add product</h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={set("title")} />
          </div>
          <div>
            <label className="label">SKU *</label>
            <input className="input" value={form.sku} onChange={set("sku")} />
          </div>
          <div>
            <label className="label">Brand</label>
            <input className="input" value={form.brand} onChange={set("brand")} />
          </div>
          <div>
            <label className="label">Price (USD)</label>
            <input className="input" value={form.price} onChange={set("price")} placeholder="0.00" />
          </div>
          <div>
            <label className="label">Cost (USD)</label>
            <input className="input" value={form.cost} onChange={set("cost")} placeholder="0.00" />
          </div>
          <div>
            <label className="label">UPC / Barcode</label>
            <input className="input" value={form.upc} onChange={set("upc")} />
          </div>
          <div>
            <label className="label">Initial stock</label>
            <input className="input" value={form.initialQty} onChange={set("initialQty")} />
          </div>
          <div className="col-span-2">
            <label className="label">Image URL</label>
            <input className="input" value={form.imageUrl} onChange={set("imageUrl")} placeholder="https://…" />
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving || !form.sku || !form.title} onClick={submit}>
            {saving ? "Saving…" : "Create product"}
          </button>
        </div>
      </div>
    </div>
  );
}
