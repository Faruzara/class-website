"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink, HelpCircle, Loader2, Play, Plus, RefreshCw, Save, Search, Trash2, X, XCircle } from "lucide-react";
import type { ApiResponse, MusicTrack, SoundCloudTrackResult } from "@/types";

type InitialState = { tracks: MusicTrack[]; clientIdConfigured: boolean; status: string; checkedAt: string | null };

async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  const result = await response.json() as ApiResponse<unknown>;
  if (!response.ok || !result.success) throw new Error(result.error ?? "Permintaan gagal.");
  return result.data;
}

function StatusBadge({ status, configured, checkedAt }: { status: string; configured: boolean; checkedAt: string | null }) {
  const states: Record<string, { icon: ReactNode; label: string; className: string }> = {
    valid: { icon: <CheckCircle2 size={13} />, label: "Aktif", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    expired: { icon: <XCircle size={13} />, label: "Kedaluwarsa", className: "border-rose-200 bg-rose-50 text-rose-700" },
    error: { icon: <XCircle size={13} />, label: "Tidak dapat diperiksa", className: "border-amber-200 bg-amber-50 text-amber-700" },
    unchecked: { icon: <RefreshCw size={13} />, label: configured ? "Belum diperiksa" : "Belum diisi", className: "border-gray-200 bg-gray-100 text-gray-500" },
  };
  const state = states[status] ?? states.unchecked;
  const time = checkedAt ? new Date(checkedAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : null;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${state.className}`}>{state.icon}{state.label}{time ? <span className="hidden opacity-60 sm:inline">· {time}</span> : null}</span>;
}

function ClientIdGuide({ onClose }: { onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="soundcloud-guide-title" className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl">
      <div className="flex items-start justify-between gap-4"><div><h3 id="soundcloud-guide-title" className="font-display text-base font-semibold text-gray-900">Menyiapkan Client ID</h3><p className="mt-1 text-xs leading-5 text-gray-500">Gunakan kredensial aplikasi SoundCloud milik sendiri agar akses stabil dan dapat dikelola.</p></div><button onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Tutup panduan"><X size={16} /></button></div>
      <ol className="mt-5 space-y-4 text-sm text-gray-700">
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-gray-900 text-[10px] font-bold text-white">1</span><p>Buka halaman developer SoundCloud dan daftarkan aplikasi yang digunakan situs ini.</p></li>
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-gray-900 text-[10px] font-bold text-white">2</span><p>Salin Client ID aplikasi tersebut. Jangan memasukkan Client Secret ke situs.</p></li>
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-gray-900 text-[10px] font-bold text-white">3</span><p>Tempel Client ID di halaman ini, kemudian pilih Simpan & cek.</p></li>
      </ol>
      <a href="https://developers.soundcloud.com/docs/api/register-app" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-950">Dokumentasi resmi SoundCloud <ExternalLink size={12} /></a>
      <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">Jika status berubah menjadi kedaluwarsa atau ditolak, perbarui kredensial di SoundCloud lalu simpan Client ID yang baru.</p>
    </section>
  </div>;
}

export default function MusicManager({ initial }: { initial: InitialState }) {
  const [tracks, setTracks] = useState(initial.tracks);
  const [clientId, setClientId] = useState("");
  const [configured, setConfigured] = useState(initial.clientIdConfigured);
  const [status, setStatus] = useState(initial.status);
  const [checkedAt, setCheckedAt] = useState(initial.checkedAt);
  const [showClientId, setShowClientId] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<SoundCloudTrackResult[]>([]);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  function setCheckedStatus(next: string) { setStatus(next); setCheckedAt(new Date().toISOString()); }

  async function saveClientId() {
    if (!clientId.trim()) return;
    setBusy("client"); setMessage("");
    try {
      await request("/api/admin/music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-client-id", clientId }) });
      setConfigured(true); setCheckedStatus("valid"); setClientId(""); setMessage("Client ID valid dan tersimpan.");
    } catch (error) { const text = error instanceof Error ? error.message : "Gagal menyimpan."; setConfigured(true); setCheckedStatus(/kedaluwarsa|ditolak/.test(text) ? "expired" : "error"); setMessage(text); }
    finally { setBusy(""); }
  }

  async function testClientId() {
    setBusy("test"); setMessage("");
    try { await request("/api/admin/music?action=test-client-id"); setCheckedStatus("valid"); setMessage("Client ID masih valid."); }
    catch (error) { setCheckedStatus(error instanceof Error && /kedaluwarsa|ditolak/.test(error.message) ? "expired" : "error"); setMessage(error instanceof Error ? error.message : "Pemeriksaan gagal."); }
    finally { setBusy(""); }
  }

  async function search() {
    if (query.trim().length < 2) return;
    setBusy("search"); setMessage("");
    try { const found = await request(`/api/admin/music?q=${encodeURIComponent(query.trim())}`) as SoundCloudTrackResult[]; setResults(found); setResultsOpen(true); setCheckedStatus("valid"); }
    catch (error) { const text = error instanceof Error ? error.message : "Pencarian gagal."; if (/kedaluwarsa|ditolak/.test(text)) setCheckedStatus("expired"); setMessage(text); }
    finally { setBusy(""); }
  }

  async function add(track?: SoundCloudTrackResult) {
    const key = track?.soundcloud_url ?? "url"; setBusy(key); setMessage("");
    try { const added = await request("/api/admin/music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(track ? { track } : { url }) }) as MusicTrack; setTracks((current) => [...current, added]); if (!track) setUrl(""); setMessage(`“${added.title}” ditambahkan ke playlist.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Gagal menambahkan."); }
    finally { setBusy(""); }
  }

  async function patchTrack(track: MusicTrack, changes: Partial<MusicTrack>) {
    const optimistic = { ...track, ...changes }; setTracks((current) => current.map((item) => item.id === track.id ? optimistic : item));
    try { await request(`/api/admin/music/${track.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) }); }
    catch (error) { setTracks((current) => current.map((item) => item.id === track.id ? track : item)); setMessage(error instanceof Error ? error.message : "Gagal memperbarui."); }
  }

  async function move(index: number, direction: -1 | 1) {
    const other = index + direction; if (other < 0 || other >= tracks.length) return;
    const next = [...tracks]; [next[index], next[other]] = [next[other], next[index]]; setTracks(next);
    await Promise.all([patchTrack(next[index], { position: index }), patchTrack(next[other], { position: other })]);
  }

  async function remove(track: MusicTrack) {
    if (!window.confirm(`Hapus “${track.title}” dari playlist?`)) return;
    try { await request(`/api/admin/music/${track.id}`, { method: "DELETE" }); setTracks((current) => current.filter((item) => item.id !== track.id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Gagal menghapus."); }
  }

  return <div className="space-y-5">
    {showGuide ? <ClientIdGuide onClose={() => setShowGuide(false)} /> : null}
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-display text-base font-semibold text-gray-900">SoundCloud Client ID</h2><p className="mt-0.5 text-xs text-gray-500">Dipakai server untuk pencarian. Nilai tersimpan tidak pernah ditampilkan kembali.</p></div><StatusBadge status={status} configured={configured} checkedAt={checkedAt} /></header>
      {status === "expired" ? <div className="flex items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-5 py-3"><p className="text-xs text-rose-700">Client ID ditolak atau kedaluwarsa.</p><button onClick={() => setShowGuide(true)} className="shrink-0 text-xs font-semibold text-rose-700">Cara update</button></div> : null}
      <div className="px-5 py-4"><div className="relative"><input type={showClientId ? "text" : "password"} value={clientId} onChange={(event) => setClientId(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void saveClientId(); }} placeholder={configured ? "Isi untuk mengganti client ID" : "Tempel client ID di sini"} className="w-full rounded-xl border border-gray-200 py-2.5 pl-3 pr-10 text-sm outline-none focus:border-gray-400" /><button type="button" onClick={() => setShowClientId((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700" aria-label={showClientId ? "Sembunyikan client ID" : "Tampilkan client ID"}>{showClientId ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={saveClientId} disabled={!clientId.trim() || busy === "client"} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy === "client" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Simpan & cek</button>{configured ? <button onClick={testClientId} disabled={busy === "test"} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40">{busy === "test" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}Cek sekarang</button> : null}<button onClick={() => setShowGuide(true)} className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"><HelpCircle size={13} />Panduan</button></div>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><header className="border-b border-gray-100 px-5 py-4"><h2 className="font-display text-base font-semibold text-gray-900">Tambah lagu</h2></header><div className="space-y-3 px-5 py-4">
      <div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Cari lagu atau artis di SoundCloud" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" /><button onClick={search} disabled={busy === "search"} className="grid size-10 shrink-0 place-items-center rounded-xl bg-gray-900 text-white disabled:opacity-40">{busy === "search" ? <Loader2 className="animate-spin" size={15} /> : <Search size={15} />}</button></div>
      {results.length ? <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50"><button onClick={() => setResultsOpen((value) => !value)} className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-medium text-gray-500"><span>{results.length} hasil pencarian</span>{resultsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>{resultsOpen ? <div className="divide-y divide-gray-100 border-t border-gray-100">{results.map((track) => <div key={track.soundcloud_url}><div className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-800">{track.title}</p><p className="truncate text-xs text-gray-500">{track.artist}</p></div><button onClick={() => setPreviewUrl((current) => current === track.soundcloud_url ? "" : track.soundcloud_url)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-gray-200 bg-white" aria-label={`Preview ${track.title}`}><Play size={13} fill="currentColor" /></button><button onClick={() => add(track)} disabled={Boolean(busy)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-gray-200 bg-white disabled:opacity-40" aria-label={`Tambahkan ${track.title}`}><Plus size={14} /></button></div>{previewUrl === track.soundcloud_url ? <iframe title={`Preview ${track.title}`} src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(track.soundcloud_url)}&auto_play=true&show_artwork=false&show_comments=false&show_user=true&sharing=false&download=false`} className="h-[86px] w-full border-0 bg-white" allow="autoplay" /> : null}</div>)}</div> : null}</div> : null}
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-gray-400"><span className="h-px flex-1 bg-gray-100" />atau lewat link<span className="h-px flex-1 bg-gray-100" /></div>
      <div className="flex gap-2"><input value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && url.trim()) void add(); }} placeholder="https://soundcloud.com/..." className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400" /><button onClick={() => add()} disabled={!url.trim() || busy === "url"} className="grid size-10 shrink-0 place-items-center rounded-xl bg-gray-900 text-white disabled:opacity-40">{busy === "url" ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />}</button></div>
    </div></section>

    {message ? <p role="status" className="px-1 text-sm text-gray-600">{message}</p> : null}

    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><header className="flex items-center justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="font-display text-base font-semibold text-gray-900">Playlist publik</h2><p className="mt-0.5 text-xs text-gray-500">Hanya lagu berstatus tampil yang muncul di dock.</p></div><span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">{tracks.length} lagu</span></header><div className="divide-y divide-gray-100">{tracks.length ? tracks.map((track, index) => <div key={track.id} className="flex items-center gap-2 px-4 py-3 sm:px-5"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-800">{track.title}</p><p className="truncate text-xs text-gray-500">{track.artist}</p></div><label className="flex shrink-0 cursor-pointer items-center gap-1.5"><span className="relative"><input type="checkbox" checked={track.is_active} onChange={(event) => patchTrack(track, { is_active: event.target.checked })} className="peer sr-only" /><span className="block h-5 w-9 rounded-full bg-gray-200 transition-colors peer-checked:bg-gray-900" /><span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" /></span><span className="hidden text-[10px] text-gray-500 sm:inline">Tampil</span></label><div className="flex shrink-0 flex-col"><button onClick={() => move(index, -1)} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20" aria-label="Naik"><ArrowUp size={13} /></button><button onClick={() => move(index, 1)} disabled={index === tracks.length - 1} className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20" aria-label="Turun"><ArrowDown size={13} /></button></div><button onClick={() => remove(track)} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Hapus"><Trash2 size={14} /></button></div>) : <p className="py-10 text-center text-sm text-gray-400">Playlist masih kosong.</p>}</div></section>
  </div>;
}
