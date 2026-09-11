"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { ACTIVITY_CATEGORY_LABELS, ACTIVITY_ROLE_LABELS, activityActionLabel, activityCategory, type ActivityCategory } from "@/lib/activity-log";
import type { ActivityLog, Role } from "@/types";

type RoleFilter = "all" | Role;
type CategoryFilter = "all" | ActivityCategory;

const ROLE_COLOR: Record<Role, string> = {
  owner: "text-amber-700",
  admin: "text-brand-700",
  temp_admin: "text-cyan-700",
};

function formatDay(value: string) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export default function OwnerActivityLog({ initialLogs, unavailable }: { initialLogs: ActivityLog[]; unavailable: boolean }) {
  const [logs, setLogs] = useState(initialLogs);
  const [role, setRole] = useState<RoleFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(unavailable ? "Activity data could not be loaded." : "");
  const [hasMore, setHasMore] = useState(initialLogs.length >= 30);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return logs.filter((log) => {
      if (role !== "all" && log.actor_role !== role) return false;
      if (category !== "all" && activityCategory(log.action) !== category) return false;
      if (!normalizedQuery) return true;
      return [log.actor_label, activityActionLabel(log.action), log.detail ?? "", log.device_label ?? "", log.ip_address ?? "", log.user_agent ?? ""]
        .some((value) => value.toLocaleLowerCase("id-ID").includes(normalizedQuery));
    });
  }, [category, logs, query, role]);

  async function loadMore() {
    const cursor = logs.at(-1)?.created_at;
    if (!cursor || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/owner/activity?before=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error);
      setLogs((current) => [...current, ...result.data.items]);
      setHasMore(result.data.hasMore);
    } catch {
      setError("Riwayat berikutnya gagal dimuat. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  let previousDay = "";

  return (
    <section id="owner-activity" className="scroll-mt-6 border-t border-surface-border py-10">
      <header className="mb-7 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase text-brand-700">System Record / 08</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-gray-900">Activity Log</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">Jejak perubahan dan akses. Detail jaringan hanya terlihat setelah baris dibuka.</p>
        </div>
        <label className="relative block w-full md:w-64">
          <span className="sr-only">Cari activity</span>
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari aktor atau aksi" className="min-h-11 w-full border-b border-surface-border bg-transparent pl-6 pr-2 text-sm outline-none focus:border-brand-500" />
        </label>
      </header>

      <div className="mb-7 flex flex-col gap-4 border-y border-surface-border py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Filter role">
          {(["all", "owner", "admin", "temp_admin"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setRole(value)} aria-pressed={role === value} className={`min-h-8 font-mono text-[10px] uppercase transition-colors ${role === value ? "text-brand-700 underline decoration-brand-500 underline-offset-4" : "text-gray-400 hover:text-gray-700"}`}>
              {value === "all" ? "All roles" : ACTIVITY_ROLE_LABELS[value]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-xs text-gray-500">
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value as CategoryFilter)} className="min-h-9 border border-surface-border bg-white px-3 text-xs text-gray-700 outline-none focus:border-brand-500">
            <option value="all">All</option>
            {(Object.keys(ACTIVITY_CATEGORY_LABELS) as ActivityCategory[]).map((value) => <option key={value} value={value}>{ACTIVITY_CATEGORY_LABELS[value]}</option>)}
          </select>
        </label>
      </div>

      {visible.length ? (
        <div>
          {visible.map((log, index) => {
            const day = formatDay(log.created_at);
            const showDay = day !== previousDay;
            previousDay = day;
            const isOpen = expanded === log.id;
            return (
              <div key={log.id}>
                {showDay ? <p className={`border-b border-surface-border pb-2 font-mono text-[10px] uppercase text-gray-400 ${index === 0 ? "pt-0" : "pt-6"}`}>{day}</p> : null}
                <button type="button" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? null : log.id)} className="group grid min-h-[68px] w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-surface-border py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 md:grid-cols-[4rem_9rem_minmax(0,1fr)_7rem_auto]">
                  <time dateTime={log.created_at} className="font-mono text-[10px] text-gray-400">{formatTime(log.created_at)}</time>
                  <span className={`truncate text-xs font-medium ${ROLE_COLOR[log.actor_role]}`}>{log.actor_label}</span>
                  <span className="col-span-2 col-start-2 mt-1 text-sm text-gray-800 md:col-span-1 md:col-start-auto md:mt-0">{activityActionLabel(log.action)}</span>
                  <span className="hidden font-mono text-[10px] uppercase text-gray-400 md:block">{ACTIVITY_CATEGORY_LABELS[activityCategory(log.action)]}</span>
                  <ChevronDown size={15} aria-hidden="true" className={`col-start-3 row-start-1 text-gray-300 transition-transform md:col-start-auto ${isOpen ? "rotate-180 text-brand-600" : "group-hover:text-gray-600"}`} />
                </button>
                {isOpen ? (
                  <dl className="grid gap-x-6 gap-y-4 border-b border-surface-border bg-white/45 px-3 py-5 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="font-mono text-[9px] uppercase text-gray-400">Detail</dt><dd className="mt-1 break-words text-gray-700">{log.detail ?? "No additional detail"}</dd></div>
                    <div><dt className="font-mono text-[9px] uppercase text-gray-400">IP Address</dt><dd className="mt-1 font-mono text-gray-700">{log.ip_address ?? "Not recorded"}</dd></div>
                    <div><dt className="font-mono text-[9px] uppercase text-gray-400">Device</dt><dd className="mt-1 text-gray-700">{log.device_label ?? "Not recorded"}</dd></div>
                    <div><dt className="font-mono text-[9px] uppercase text-gray-400">Result</dt><dd className={`mt-1 capitalize ${log.event_status === "failure" ? "text-brand-700" : "text-gray-700"}`}>{log.event_status ?? "info"}</dd></div>
                    {log.user_agent ? <div className="sm:col-span-2 lg:col-span-4"><dt className="font-mono text-[9px] uppercase text-gray-400">User Agent</dt><dd className="mt-1 break-all font-mono text-[10px] leading-5 text-gray-500">{log.user_agent}</dd></div> : null}
                    {log.session_id ? <div className="sm:col-span-2 lg:col-span-4"><dt className="font-mono text-[9px] uppercase text-gray-400">Session ID</dt><dd className="mt-1 break-all font-mono text-[10px] text-gray-500">{log.session_id}</dd></div> : null}
                  </dl>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="border-y border-surface-border py-10 text-center text-sm text-gray-500">{logs.length ? "Tidak ada activity yang cocok dengan filter." : "Belum ada activity yang tercatat."}</p>
      )}

      {error ? <p role="alert" className="mt-4 text-sm text-brand-700">{error}</p> : null}
      {hasMore ? (
        <button type="button" onClick={loadMore} disabled={loading} className="mt-6 inline-flex min-h-11 items-center gap-2 border-b border-brand-500 text-sm font-medium text-gray-700 hover:text-brand-700 disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
          {loading ? "Loading..." : "Load older activity"}
        </button>
      ) : logs.length ? <p className="mt-6 font-mono text-[10px] uppercase text-gray-400">End of activity</p> : null}
    </section>
  );
}
