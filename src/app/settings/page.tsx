import { prisma } from "@/lib/prisma";
import { currentAccountId } from "@/lib/account";
import { listChannelTypes } from "@/lib/channels/registry";
import { PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const accountId = await currentAccountId();

  const [account, warehouses, logs] = await Promise.all([
    prisma.account.findUnique({ where: { id: accountId }, include: { users: true } }),
    prisma.warehouse.findMany({ where: { accountId }, orderBy: { isDefault: "desc" } }),
    prisma.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { channel: true } }),
  ]);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Account, warehouses, integrations and sync activity" />
      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700">Account</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-50 py-1">
              <dt className="text-slate-400">Name</dt>
              <dd className="font-medium text-slate-700">{account?.name}</dd>
            </div>
            {account?.users.map((u) => (
              <div key={u.id} className="flex justify-between border-b border-slate-50 py-1">
                <dt className="text-slate-400">{u.role.toLowerCase()}</dt>
                <dd className="font-medium text-slate-700">{u.email}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700">Warehouses</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {warehouses.map((w) => (
              <li key={w.id} className="flex items-center justify-between border-b border-slate-50 py-1">
                <span>
                  <span className="font-medium text-slate-700">{w.name}</span>
                  <span className="ml-2 font-mono text-xs text-slate-400">{w.code}</span>
                </span>
                <span className="text-xs text-slate-400">
                  {[w.city, w.region, w.country].filter(Boolean).join(", ")}
                  {w.isDefault && <span className="ml-2 badge bg-brand-50 text-brand-700">default</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700">Integration credentials</h2>
          <p className="mt-1 text-xs text-slate-400">Set these in your <code>.env</code> to enable live marketplace calls.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
            {listChannelTypes().map((t) => (
              <li key={t.type} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="font-medium text-slate-700">{t.label}</span>
                <span className={`text-xs ${t.configured ? "text-emerald-600" : "text-slate-400"}`}>
                  {t.configured ? "configured" : "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-700">Sync activity</h2>
          </div>
          {logs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No sync activity yet.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Time</th>
                  <th className="th">Channel</th>
                  <th className="th">Kind</th>
                  <th className="th">Status</th>
                  <th className="th">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="td whitespace-nowrap text-slate-500">{l.createdAt.toLocaleString()}</td>
                    <td className="td">{l.channel?.name ?? "—"}</td>
                    <td className="td text-xs">{l.kind.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="td">
                      <span
                        className={`badge ${
                          l.status === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700"
                            : l.status === "SKIPPED"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {l.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="td max-w-md truncate text-slate-600">{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
