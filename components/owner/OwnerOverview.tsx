"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import type { OwnerDataSource, OwnerOverviewSnapshot } from "@/lib/owner-dashboard-data";
import type { ActivityLog } from "@/types";
import { activityActionLabel } from "@/lib/activity-log";

const SOURCE_LABELS: Record<OwnerDataSource, string> = {
  access: "Admin access",
  temporary: "Temporary access",
  sessions: "Sessions",
  homepage: "Homepage",
  schedule: "Schedule",
  members: "Members",
  gallery: "Gallery",
  announcements: "Announcements",
  feedback: "Feedback",
  moments: "Moments",
  activity: "Activity",
};

const SOURCE_TARGETS: Record<OwnerDataSource, string> = {
  access: "/owner/access/admin-slots",
  temporary: "/owner/access/temporary",
  sessions: "/owner/access/sessions",
  homepage: "/owner/content/homepage",
  schedule: "/owner/content/schedule",
  members: "/owner/content/members",
  gallery: "/owner/content/gallery",
  announcements: "/owner/content/homepage?tab=announcements",
  feedback: "/owner/feedback",
  moments: "/owner/moments",
  activity: "/owner/activity",
};

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function remainingMinutes(expiresAt: string, now: number) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60000));
}

function Metric({ label, value, note, href, unavailable = false, compact = false }: { label: string; value: string; note: string; href?: string; unavailable?: boolean; compact?: boolean }) {
  const body = (
    <>
      <p className="font-mono text-[10px] uppercase text-gray-500">{label}</p>
      <p className={`mt-3 font-display font-semibold leading-none ${compact ? "text-[clamp(1.5rem,7.5vw,2.75rem)]" : "text-[clamp(2.4rem,5vw,3.5rem)]"} ${unavailable ? "text-gray-300" : "text-gray-900"}`}>
        {unavailable ? "--" : value}
      </p>
      <p className="mt-2 text-xs leading-5 text-gray-500">{unavailable ? "Data unavailable" : note}</p>
    </>
  );

  return href ? (
    <a href={href} className="group block min-w-0 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4">
      {body}
      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        Open <ArrowRight size={12} aria-hidden="true" />
      </span>
    </a>
  ) : <div className="min-w-0 py-5">{body}</div>;
}

export default function OwnerOverview({ snapshot, logs }: { snapshot: OwnerOverviewSnapshot; logs: ActivityLog[] }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const now = useMemo(() => new Date(snapshot.refreshedAt).getTime(), [snapshot.refreshedAt]);
  const failed = new Set(snapshot.unavailable);
  const nearestMinutes = snapshot.temporary.nearest ? remainingMinutes(snapshot.temporary.nearest.expiresAt, now) : null;

  const attention = [
    ...snapshot.unavailable.map((source) => ({ area: "DATA", text: `${SOURCE_LABELS[source]} gagal dimuat.`, href: SOURCE_TARGETS[source] })),
    ...snapshot.admin.expiring.map((slot) => ({ area: "ACCESS", text: `${slot.label || `Admin Slot ${slot.id}`} berakhir kurang dari 3 hari lagi.`, href: "/owner/access/admin-slots" })),
    ...(snapshot.temporary.nearest && nearestMinutes !== null && nearestMinutes <= 30
      ? [{ area: "ACCESS", text: `${snapshot.temporary.nearest.label} berakhir dalam ${nearestMinutes} menit.`, href: "/owner/access/temporary" }]
      : []),
    ...(snapshot.moments.cleanupPending > 0
      ? [{ area: "MOMENTS", text: `${snapshot.moments.cleanupPending} upload atau penghapusan perlu dibersihkan.`, href: "/owner/moments" }]
      : []),
    ...(!failed.has("homepage") && !snapshot.content.homepage.complete
      ? [{ area: "CONTENT", text: snapshot.content.homepage.hasRecord ? "Foto utama atau deskripsi Homepage belum lengkap." : "Homepage belum dikonfigurasi.", href: "/owner/content/homepage" }]
      : []),
    ...(!failed.has("schedule") && snapshot.content.schedule.count === 0
      ? [{ area: "CONTENT", text: "Schedule masih kosong.", href: "/owner/content/schedule" }]
      : []),
    ...(!failed.has("members") && snapshot.content.members.visible === 0
      ? [{ area: "CONTENT", text: "Belum ada anggota yang tampil publik.", href: "/owner/content/members" }]
      : []),
    ...(!failed.has("gallery") && snapshot.content.gallery.count === 0
      ? [{ area: "CONTENT", text: "Gallery masih kosong.", href: "/owner/content/gallery" }]
      : []),
  ];

  const contentRows = [
    {
      id: "owner-content-homepage", index: "01", title: "Homepage", href: "/owner/content/homepage",
      detail: snapshot.content.homepage.complete ? "Foto utama dan profil kelas tersedia" : "Konten utama belum lengkap",
      status: snapshot.content.homepage.complete ? "Complete" : "Review", unavailable: failed.has("homepage"),
    },
    {
      id: "owner-content-schedule", index: "02", title: "Schedule", href: "/owner/content/schedule",
      detail: `${snapshot.content.schedule.count} lesson entries`, status: snapshot.content.schedule.count ? "Ready" : "Empty", unavailable: failed.has("schedule"),
    },
    {
      id: "owner-content-members", index: "03", title: "Members", href: "/owner/content/members",
      detail: `${snapshot.content.members.visible} visible / ${snapshot.content.members.total} total`,
      status: snapshot.content.members.visible ? (snapshot.content.members.visible < snapshot.content.members.total ? `${snapshot.content.members.total - snapshot.content.members.visible} hidden` : "Ready") : "Empty",
      unavailable: failed.has("members"),
    },
    {
      id: "owner-content-gallery", index: "04", title: "Gallery", href: "/owner/content/gallery",
      detail: `${snapshot.content.gallery.count} photos`, status: snapshot.content.gallery.count ? "Ready" : "Empty", unavailable: failed.has("gallery"),
    },
  ];

  return (
    <section id="owner-overview" className="scroll-mt-20 lg:scroll-mt-8">
      <header className="border-b border-surface-border pb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] uppercase text-brand-700">Owner Control / 01</p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-gray-900 sm:text-[2.15rem]">Overview</h1>
            <p className="mt-2 text-sm text-gray-500">XI Teknik Pemesinan 2</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" target="_blank" className="inline-flex min-h-11 items-center gap-2 px-3 text-sm text-gray-600 transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              View Public Site <ExternalLink size={14} aria-hidden="true" />
            </Link>
            <button type="button" title="Refresh overview" aria-label="Refresh overview" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())} className="flex h-11 w-11 items-center justify-center text-gray-600 transition-colors hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50">
              <RefreshCw size={16} aria-hidden="true" className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} />
            </button>
          </div>
        </div>
        <p className="mt-6 font-mono text-[10px] text-gray-400">
          {refreshing ? "Refreshing data..." : `Last synced ${formatTime(snapshot.refreshedAt)} WIB`}
        </p>
      </header>

      <div className="grid grid-cols-2 border-b border-surface-border sm:grid-cols-4">
        <div className="border-r border-surface-border pr-4 sm:pr-6">
          <Metric compact label="Data Status" value={snapshot.unavailable.length ? "PARTIAL" : "SYNCED"} note={snapshot.unavailable.length ? `${snapshot.unavailable.length} source unavailable` : "All sources responded"} />
        </div>
        <div className="pl-4 sm:border-r sm:border-surface-border sm:px-6">
          <Metric label="Permanent Admin" value={`${twoDigits(snapshot.admin.active)} / ${twoDigits(snapshot.admin.total)}`} note={`${Math.max(0, snapshot.admin.total - snapshot.admin.active)} slot available`} href="/owner/access/admin-slots" unavailable={failed.has("access")} />
        </div>
        <div className="border-r border-t border-surface-border pr-4 sm:border-t-0 sm:px-6">
          <Metric label="Temporary Access" value={twoDigits(snapshot.temporary.active)} note={nearestMinutes === null ? "No active access" : `${nearestMinutes} min nearest expiry`} href="/owner/access/temporary" unavailable={failed.has("temporary")} />
        </div>
        <div className="border-t border-surface-border pl-4 sm:border-t-0 sm:pl-6">
          <Metric label="Moments Live" value={twoDigits(snapshot.moments.live)} note={snapshot.moments.live ? "Live on public site" : "No Moments live"} href="/owner/moments" unavailable={failed.has("moments")} />
        </div>
      </div>

      <section className="py-10">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="font-mono text-[11px] uppercase text-gray-500">Content Health</h2>
          <span className="font-mono text-[10px] text-gray-400">04 sections</span>
        </div>
        <div className="border-t border-surface-border">
          {contentRows.map((row) => (
            <Link key={row.id} id={row.id} href={row.href} className="group grid min-h-[76px] scroll-mt-20 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-surface-border py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:grid-cols-[2rem_10rem_minmax(0,1fr)_6rem_1rem]">
              <span className="col-start-1 row-start-1 font-mono text-[10px] text-gray-400">{row.index}</span>
              <span className="col-start-2 row-start-1 text-sm font-semibold text-gray-900">{row.title}</span>
              <span className="col-span-2 col-start-2 row-start-2 text-xs text-gray-500 sm:col-span-1 sm:col-start-3 sm:row-start-1">{row.unavailable ? "Data unavailable" : row.detail}</span>
              <span className={`col-start-3 row-start-1 text-right font-mono text-[10px] uppercase sm:col-start-4 ${row.unavailable ? "text-gray-400" : row.status === "Review" || row.status === "Empty" ? "text-amber-700" : "text-gray-500"}`}>{row.unavailable ? "Unknown" : row.status}</span>
              <ArrowRight size={14} aria-hidden="true" className="hidden text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-600 sm:col-start-5 sm:row-start-1 sm:block" />
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-surface-border py-10">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="font-mono text-[11px] uppercase text-gray-500">Needs Attention</h2>
          <span className={`font-mono text-xs ${attention.length ? "text-brand-700" : "text-gray-400"}`}>{twoDigits(attention.length)}</span>
        </div>
        {attention.length ? (
          <div className="border-t border-surface-border">
            {attention.map((item) => (
              <a key={`${item.area}-${item.text}`} href={item.href} className="group grid min-h-14 grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-surface-border py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
                <span className="font-mono text-[10px] text-brand-700">{item.area}</span>
                <span className="text-sm leading-5 text-gray-700">{item.text}</span>
                <span className="flex items-center gap-2 font-mono text-[10px] text-gray-400"><span className="hidden sm:inline">Review</span><ArrowRight size={13} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></span>
              </a>
            ))}
          </div>
        ) : (
          <p className="border-y border-surface-border py-5 text-sm text-gray-500">No action needed. Semua data utama terlihat sehat.</p>
        )}
      </section>

      <section className="border-t border-surface-border py-10">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h2 className="font-mono text-[11px] uppercase text-gray-500">Recent Activity</h2>
          <a href="/owner/activity" className="text-xs text-gray-500 underline decoration-brand-500 underline-offset-4 hover:text-brand-700">View all activity</a>
        </div>
        {failed.has("activity") ? (
          <p className="border-y border-surface-border py-5 text-sm text-gray-500">Activity data could not be loaded. Refresh to try again.</p>
        ) : logs.length ? (
          <div className="border-t border-surface-border">
            {logs.slice(0, 5).map((log) => (
              <div key={log.id} className="grid min-h-14 grid-cols-[3rem_minmax(0,1fr)] gap-x-3 border-b border-surface-border py-3 sm:grid-cols-[3.5rem_9rem_minmax(0,1fr)] sm:items-center">
                <time dateTime={log.created_at} className="font-mono text-[10px] text-gray-400">{formatTime(log.created_at)}</time>
                <span className="truncate text-xs font-medium text-gray-600">{log.actor_label}</span>
                <div className="col-start-2 mt-1 min-w-0 sm:col-start-auto sm:mt-0">
                  <p className="text-sm text-gray-800">{activityActionLabel(log.action)}</p>
                  {log.detail ? <p className="mt-0.5 truncate text-xs text-gray-400">{log.detail}</p> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="border-y border-surface-border py-5 text-sm text-gray-500">Activity will appear after the first Owner or Admin action.</p>
        )}
      </section>
    </section>
  );
}
