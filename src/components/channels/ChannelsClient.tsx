"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plug, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/ui";

export interface ChannelTypeInfo {
  type: string;
  label: string;
  configured: boolean;
  priority: boolean;
  docsUrl: string;
}
export interface ChannelRow {
  id: string;
  type: string;
  name: string;
  status: string;
  shopDomain: string | null;
  priceMarkupPct: number;
  autoSync: boolean;
  lastSyncAt: string | null;
  listings: number;
  orders: number;
}

export function ChannelsClient({
  channels,
  types,
  flash,
}: {
  channels: ChannelRow[];
  types: ChannelTypeInfo[];
  flash?: { kind: "ok" | "err"; message: string } | null;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function connect(id: string) {
    setBusy(id);
    const res = await fetch(`/api/channels/${id}/connect`, { method: "POST" });
    const body = await res.json();
    setBusy(null);
    if (res.ok && body.url) {
      window.location.href = body.url;
    } else {
      alert(body.error ?? "Unable to start connection");
    }
  }

  async function sync(id: string) {
    setBusy(id);
    const res = await fetch(`/api/channels/${id}/sync`, { method: "POST" });
    const body = await res.json();
    setBusy(null);
    alert(body.message ?? "Synced");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this channel? Listings on it will be detached.")) return;
    await fetch(`/api/channels/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function toggleAutoSync(id: string, autoSync: boolean) {
    await fetch(`/api/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoSync }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {flash && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            flash.kind === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {flash.message}
        </div>
      )}

      <div className="flex justify-between">
        <p className="text-sm text-slate-500">
          Connect your marketplaces. Priority channels (eBay, Etsy, Shopify) are fully wired; Amazon and Walmart are available too.
        </p>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          <Plug size={16} /> Add channel
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {channels.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-slate-900">{c.name}</div>
                <div className="text-xs text-slate-400">
                  {c.type}
                  {c.shopDomain ? ` · ${c.shopDomain}` : ""}
                </div>
              </div>
              <StatusBadge status={c.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div>Listings: <b className="text-slate-700">{c.listings}</b></div>
              <div>Orders: <b className="text-slate-700">{c.orders}</b></div>
              <div>Markup: <b className="text-slate-700">{c.priceMarkupPct}%</b></div>
              <div>Last sync: <b className="text-slate-700">{c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString() : "never"}</b></div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={c.autoSync} onChange={(e) => toggleAutoSync(c.id, e.target.checked)} />
              Auto-sync inventory &amp; orders
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              {c.status === "CONNECTED" ? (
                <button className="btn-ghost h-8" disabled={busy === c.id} onClick={() => sync(c.id)}>
                  <RefreshCw size={14} /> Sync now
                </button>
              ) : (
                <button className="btn-primary h-8" disabled={busy === c.id} onClick={() => connect(c.id)}>
                  <Plug size={14} /> Connect
                </button>
              )}
              <button className="btn-danger h-8" onClick={() => remove(c.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {channels.length === 0 && (
          <div className="card col-span-full p-10 text-center text-sm text-slate-400">
            No channels yet. Add one to start listing.
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-700">Integration status</h2>
        <p className="mt-1 text-xs text-slate-400">
          Whether the app has API credentials in its environment for each marketplace.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {types.map((t) => (
            <div key={t.type} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-800">{t.label}</span>
                {t.priority && <span className="badge bg-brand-50 text-brand-700">priority</span>}
              </div>
              <div className={`mt-1 text-xs ${t.configured ? "text-emerald-600" : "text-slate-400"}`}>
                {t.configured ? "credentials set" : "no credentials"}
              </div>
              <a href={t.docsUrl} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                docs <ExternalLink size={11} />
              </a>
            </div>
          ))}
        </div>
      </div>

      {showAdd && <AddChannelModal types={types} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddChannelModal({ types, onClose }: { types: ChannelTypeInfo[]; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState(types[0]?.type ?? "EBAY");
  const [name, setName] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [markup, setMarkup] = useState("0");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        name: name || `${type} store`,
        shopDomain: type === "SHOPIFY" ? shopDomain : undefined,
        priceMarkupPct: Number(markup) || 0,
      }),
    });
    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4">
      <div className="card w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-900">Add channel</h3>
        <div className="mt-4 space-y-3">
          <div>
            <label className="label">Marketplace</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {types.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                  {t.configured ? "" : " (no credentials)"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Display name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. eBay — US store" />
          </div>
          {type === "SHOPIFY" && (
            <div>
              <label className="label">Shop domain</label>
              <input
                className="input"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
              />
            </div>
          )}
          <div>
            <label className="label">Price markup %</label>
            <input className="input" value={markup} onChange={(e) => setMarkup(e.target.value)} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving} onClick={submit}>
            {saving ? "Adding…" : "Add channel"}
          </button>
        </div>
      </div>
    </div>
  );
}
