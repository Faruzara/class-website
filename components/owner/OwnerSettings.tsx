"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { OwnerOverviewSnapshot } from "@/lib/owner-dashboard-data";

export default function OwnerSettings({ initialCreatorGithubUrl, overview }: { initialCreatorGithubUrl: string; overview: OwnerOverviewSnapshot }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [creatorGithubUrl, setCreatorGithubUrl] = useState(initialCreatorGithubUrl);
  const [creatorSaved, setCreatorSaved] = useState(initialCreatorGithubUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveRef = useRef(false);

  async function saveCreatorGithub() {
    if (creatorGithubUrl === creatorSaved || saveRef.current) return;
    saveRef.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_github_url: creatorGithubUrl || null }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) setError(result.error ?? "Gagal menyimpan URL GitHub.");
      else setCreatorSaved(creatorGithubUrl);
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      saveRef.current = false;
      setSaving(false);
    }
  }

  return (
    <section id="owner-settings" className="scroll-mt-6 border-t border-surface-border py-10">
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase text-brand-700">Control Settings / 09</p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-gray-900">Settings</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">Identitas sistem, keamanan Owner, dan kondisi sumber data.</p>
      </header>

      <div className="border-t border-surface-border">
        <div className="grid gap-5 border-b border-surface-border py-7 md:grid-cols-[11rem_minmax(0,1fr)]">
          <div><p className="font-mono text-[10px] uppercase text-gray-400">Creator Attribution</p><p className="mt-2 text-xs leading-5 text-gray-500">Tautan kredit yang tampil pada situs publik.</p></div>
          <div className="max-w-2xl">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input className="min-h-11 flex-1 border border-surface-border bg-white px-3 text-sm outline-none focus:border-brand-500" type="url" placeholder="https://github.com/username" value={creatorGithubUrl} onChange={(event) => setCreatorGithubUrl(event.target.value)} />
              <button type="button" className="min-h-11 bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40" onClick={saveCreatorGithub} disabled={creatorGithubUrl === creatorSaved || saving}>{saving ? "Saving..." : "Save"}</button>
            </div>
            {creatorGithubUrl !== creatorSaved ? <p className="mt-2 text-xs text-amber-700">Unsaved changes</p> : null}
            {error ? <p role="alert" className="mt-2 text-xs text-brand-700">{error}</p> : null}
          </div>
        </div>

        <div className="grid gap-5 border-b border-surface-border py-7 md:grid-cols-[11rem_minmax(0,1fr)]">
          <div><p className="font-mono text-[10px] uppercase text-gray-400">Owner Security</p><p className="mt-2 text-xs leading-5 text-gray-500">Konfigurasi rahasia tetap berada di server.</p></div>
          <dl className="grid max-w-2xl gap-5 sm:grid-cols-2">
            <div><dt className="text-xs text-gray-500">Master key</dt><dd className="mt-1 text-sm font-medium text-gray-900">Environment managed</dd><p className="mt-1 text-xs text-gray-400">Nilai key tidak dapat dibaca dari dashboard.</p></div>
            <div><dt className="text-xs text-gray-500">Owner session</dt><dd className="mt-1 text-sm font-medium text-gray-900">30 days maximum</dd><a href="/owner/access/sessions" className="mt-1 inline-block text-xs text-brand-700 underline decoration-brand-300 underline-offset-4">Review active sessions</a></div>
          </dl>
        </div>

        <div className="grid gap-5 border-b border-surface-border py-7 md:grid-cols-[11rem_minmax(0,1fr)]">
          <div><p className="font-mono text-[10px] uppercase text-gray-400">System Identity</p><p className="mt-2 text-xs leading-5 text-gray-500">Identitas publik untuk pesan tingkat Owner.</p></div>
          <div className="max-w-2xl"><p className="text-sm font-medium text-gray-900">System</p><p className="mt-1 text-xs leading-5 text-gray-500">Pengumuman Owner ditampilkan sebagai System agar identitas Owner tidak diekspos di halaman publik.</p></div>
        </div>

        <div className="grid gap-5 border-b border-surface-border py-7 md:grid-cols-[11rem_minmax(0,1fr)]">
          <div><p className="font-mono text-[10px] uppercase text-gray-400">Data Status</p><p className="mt-2 text-xs leading-5 text-gray-500">Snapshot terakhir dari seluruh area Owner.</p></div>
          <div className="flex max-w-2xl flex-wrap items-center justify-between gap-4">
            <div><p className={`text-sm font-medium ${overview.unavailable.length ? "text-brand-700" : "text-gray-900"}`}>{overview.unavailable.length ? `${overview.unavailable.length} source unavailable` : "All sources responding"}</p><p className="mt-1 font-mono text-[10px] text-gray-400">Updated {new Date(overview.refreshedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</p></div>
            <button type="button" title="Refresh data" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing} className="inline-flex min-h-11 items-center gap-2 px-2 text-sm text-gray-600 hover:text-brand-700 disabled:opacity-50"><RefreshCw size={15} className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden="true" />{refreshing ? "Refreshing..." : "Refresh"}</button>
          </div>
        </div>

        <a href="/" target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 py-4 text-sm text-gray-600 hover:text-brand-700">View public site <ExternalLink size={14} aria-hidden="true" /></a>
      </div>
    </section>
  );
}
