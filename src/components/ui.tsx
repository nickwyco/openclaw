import clsx from "clsx";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-slate-200 bg-white px-8 py-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "brand" | "green" | "amber" | "red";
}) {
  const tones: Record<string, string> = {
    default: "text-slate-900",
    brand: "text-brand-700",
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={clsx("mt-2 text-2xl font-bold", tones[tone])}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  // listing / channel / order statuses → tailwind classes
  ACTIVE: "bg-emerald-50 text-emerald-700",
  CONNECTED: "bg-emerald-50 text-emerald-700",
  PAID: "bg-emerald-50 text-emerald-700",
  SHIPPED: "bg-brand-50 text-brand-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  PUBLISHING: "bg-brand-50 text-brand-700",
  DRAFT: "bg-slate-100 text-slate-600",
  INACTIVE: "bg-slate-100 text-slate-600",
  DISCONNECTED: "bg-slate-100 text-slate-600",
  AWAITING_FULFILLMENT: "bg-amber-50 text-amber-700",
  AWAITING_PAYMENT: "bg-amber-50 text-amber-700",
  ON_HOLD: "bg-amber-50 text-amber-700",
  PARTIALLY_SHIPPED: "bg-amber-50 text-amber-700",
  ERROR: "bg-red-50 text-red-700",
  EXPIRED: "bg-red-50 text-red-700",
  CANCELLED: "bg-red-50 text-red-700",
  REFUNDED: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx("badge", STATUS_TONES[status] ?? "bg-slate-100 text-slate-600")}>
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-sm font-medium text-slate-600">{title}</div>
      {hint && <div className="mt-1 max-w-md text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
