"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, Trash2 } from "lucide-react";
import MomentCameraDialog from "@/components/admin/MomentCameraDialog";
import { readMomentResponse, type OwnerMomentListing, type OwnerMomentSummary } from "@/lib/moments";
import { formatMomentTimestamp } from "@/lib/moment-time";

function remaining(expiresAt: string, now: number) {
  const minutes = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60000));
  if (minutes >= 60) return `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
  return `${minutes}m`;
}

function status(item: OwnerMomentSummary, now: number) {
  if (item.status !== "published") return { label: "CLEANUP", color: "text-amber-700" };
  if (new Date(item.expiresAt).getTime() - now <= 60 * 60 * 1000) return { label: "ENDING", color: "text-brand-700" };
  return { label: "LIVE", color: "text-emerald-700" };
}

export default function OwnerMomentsManager({ initialItems, unavailable }: { initialItems: OwnerMomentSummary[]; unavailable: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState(unavailable ? "Data Moments belum dapat dimuat." : "");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(timer); if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, []);

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/owner/moments", { cache: "no-store" });
      const listing = await readMomentResponse<OwnerMomentListing>(response);
      setItems(listing.items); setNow(new Date(listing.serverNow).getTime());
    } catch (value) {
      setError(value instanceof Error ? value.message : "Moments gagal dimuat.");
    } finally { if (!silent) setLoading(false); }
  }

  function refreshAfterCapture() {
    setNotice("Moment terkirim");
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void refresh(true), 450);
  }

  async function remove(item: OwnerMomentSummary) {
    const message = item.cleanupPending ? "Bersihkan sisa data Moment ini?" : "Hapus Moment ini sebelum masa tayangnya berakhir?";
    if (deleting || !window.confirm(message)) return;
    setDeleting(item.id); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/owner/moments/${item.id}`, { method: "DELETE" });
      await readMomentResponse<{ id: string }>(response);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setNotice(item.cleanupPending ? "Sisa data dibersihkan" : "Moment dihapus");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Moment gagal dihapus.");
    } finally { setDeleting(null); }
  }

  const active = useMemo(() => items.filter((item) => item.status === "published" && new Date(item.expiresAt).getTime() > now), [items, now]);
  const ending = active.filter((item) => new Date(item.expiresAt).getTime() - now <= 60 * 60 * 1000).length;
  const cleanup = items.filter((item) => item.status !== "published").length;

  return <section id="owner-moments" className="scroll-mt-20 border-t border-surface-border py-10 lg:scroll-mt-8">
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="font-mono text-[10px] text-brand-700">MOMENTS / OWNER ONLY</p><h2 className="mt-2 font-display text-2xl font-semibold text-gray-900">Live camera control</h2><p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">Publikasi hanya dari kamera langsung. Owner dapat memantau masa tayang dan membersihkan Moment bermasalah.</p></div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void refresh()} disabled={loading} title="Muat ulang Moments" aria-label="Muat ulang Moments" className="flex h-11 w-11 items-center justify-center border border-surface-border text-gray-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-40"><RefreshCw size={16} className={loading ? "animate-spin motion-reduce:animate-none" : ""} /></button>
        <button type="button" onClick={() => setCameraOpen(true)} className="inline-flex min-h-11 items-center gap-2 bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"><Camera size={17} />Ambil Moment</button>
      </div>
    </div>

    <div className="mt-8 grid grid-cols-3 border-y border-surface-border">
      {[['LIVE', active.length], ['ENDING < 1H', ending], ['CLEANUP', cleanup]].map(([label, value], index) => <div key={label} className={`py-5 ${index ? "border-l border-surface-border pl-4 sm:pl-6" : "pr-4"}`}><p className="font-mono text-[9px] text-gray-500">{label}</p><p className="mt-2 font-display text-3xl font-semibold text-gray-900">{String(value).padStart(2, "0")}</p></div>)}
    </div>

    <div className="min-h-8 pt-4" aria-live="polite">{error ? <p role="alert" className="text-xs text-brand-700">{error}</p> : notice ? <p className="text-xs text-gray-500">{notice}</p> : null}</div>
    {loading && !items.length ? <div className="flex min-h-32 items-center justify-center border-y border-surface-border text-gray-400"><Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-label="Memuat Moments" /></div> : !items.length ? <div className="border-y border-surface-border py-9"><p className="text-sm text-gray-700">Belum ada Moment aktif.</p><p className="mt-1 text-xs text-gray-400">Foto pertama dapat diambil langsung dari tombol kamera.</p></div> : <div className="border-t border-surface-border">
      {items.map((item, index) => { const state = status(item, now); return <article key={item.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-surface-border py-4 sm:grid-cols-[2rem_3.5rem_minmax(7rem,0.8fr)_minmax(9rem,1fr)_7rem_3rem] sm:gap-x-4">
        <span className="hidden font-mono text-[9px] text-gray-400 sm:block">{String(index + 1).padStart(2, "0")}</span>
        <div className="h-16 w-12 overflow-hidden bg-surface-muted sm:h-[72px] sm:w-14">{item.previewSrc ? <img src={item.previewSrc} alt="Preview samar Moment" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-mono text-[8px] text-gray-400">NO IMG</span>}</div>
        <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800">{item.creatorLabel || "Unknown"}</p><p className="mt-1 font-mono text-[9px] uppercase text-gray-400">{item.creatorRole.replace('_', ' ')}</p></div>
        <div className="col-start-2 mt-2 min-w-0 sm:col-start-auto sm:mt-0"><p className="text-xs text-gray-600">Dipotret {formatMomentTimestamp(item.capturedAt ?? item.createdAt)} WIB</p><p className="mt-1 text-[11px] text-gray-400">{item.cleanupPending ? `Status internal: ${item.status}` : `Berakhir dalam ${remaining(item.expiresAt, now)}`}</p></div>
        <span className={`col-start-3 row-start-1 text-right font-mono text-[9px] ${state.color} sm:col-start-auto`}>{state.label}</span>
        <button type="button" onClick={() => void remove(item)} disabled={!!deleting} title={item.cleanupPending ? "Bersihkan data" : "Hapus Moment"} aria-label={item.cleanupPending ? "Bersihkan data Moment" : "Hapus Moment"} className="col-start-3 row-start-2 flex h-11 w-11 items-center justify-center justify-self-end text-gray-400 hover:text-brand-700 disabled:opacity-30 sm:col-start-auto sm:row-start-auto">{deleting === item.id ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : <Trash2 size={16} />}</button>
      </article> })}
    </div>}
    {cameraOpen && <MomentCameraDialog onClose={() => setCameraOpen(false)} onPublished={refreshAfterCapture} />}
  </section>;
}
