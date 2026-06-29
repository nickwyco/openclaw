"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Royal Mail", "Other"];

export function FulfillBox({ orderId, shipped }: { orderId: string; shipped: boolean }) {
  const router = useRouter();
  const [carrier, setCarrier] = useState("USPS");
  const [tracking, setTracking] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/orders/${orderId}/fulfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier, trackingNumber: tracking }),
    });
    const body = await res.json();
    setSaving(false);
    setMsg(body.message ?? (res.ok ? "Done" : "Failed"));
    if (res.ok) router.refresh();
  }

  if (shipped) {
    return <p className="text-sm text-emerald-600">This order has been marked shipped.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Carrier</label>
          <select className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            {CARRIERS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tracking number</label>
          <input className="input" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="1Z…" />
        </div>
      </div>
      <button className="btn-primary" disabled={saving || !tracking} onClick={submit}>
        {saving ? "Submitting…" : "Mark shipped & push tracking"}
      </button>
      {msg && <p className="text-sm text-slate-500">{msg}</p>}
    </div>
  );
}
