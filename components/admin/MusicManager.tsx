"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink, HelpCircle, Loader2, Play, Plus, RefreshCw, Save, Search, Trash2, X, XCircle } from "lucide-react";
import type { ApiResponse, MusicTrack, Role, SoundCloudTrackResult } from "@/types";

type InitialState = { tracks: MusicTrack[]; actorRole: Role; clientIdConfigured: boolean; status: string; checkedAt: string | null };

async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, options);
  const result = await response.json() as ApiResponse<unknown>;
  if (!response.ok || !result.success) throw new Error(result.error ?? "Permintaan gagal.");
  return result.data;
}

function relativeCheckedAt(checkedAt: string | null, now: number) {
  if (!checkedAt) return "belum pernah diperiksa";
  const seconds = Math.max(0, Math.floor((now - new Date(checkedAt).getTime()) / 1000));
  if (seconds < 60) return "baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function StatusLine({ status, configured, checkedAt, now }: { status: string; configured: boolean; checkedAt: string | null; now: number }) {
  const states: Record<string, { icon: ReactNode; label: string; className: string }> = {
    valid: { icon: <CheckCircle2 size={13} />, label: "Valid", className: "text-emerald-700" },
    expired: { icon: <XCircle size={13} />, label: "Kedaluwarsa", className: "text-rose-700" },
    error: { icon: <XCircle size={13} />, label: "Pemeriksaan gagal", className: "text-amber-700" },
    unchecked: { icon: <RefreshCw size={13} />, label: configured ? "Belum diperiksa" : "Belum diisi", className: "text-gray-500" },
  };
  const state = states[status] ?? states.unchecked;
  return <p className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500"><span>Status:</span><span className={`inline-flex items-center gap-1 font-semibold ${state.className}`}>{state.icon}{state.label}</span><span>· Terakhir diperiksa {relativeCheckedAt(checkedAt, now)}</span></p>;
}

function StatusBadge({ status, configured }: { status: string; configured: boolean }) {
  const states: Record<string, { icon: ReactNode; label: string; className: string }> = {
    valid: { icon: <CheckCircle2 size={13} />, label: "Aktif", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    expired: { icon: <XCircle size={13} />, label: "Kedaluwarsa", className: "border-rose-200 bg-rose-50 text-rose-700" },
    error: { icon: <XCircle size={13} />, label: "Tidak dapat diperiksa", className: "border-amber-200 bg-amber-50 text-amber-700" },
    unchecked: { icon: <RefreshCw size={13} />, label: configured ? "Belum diperiksa" : "Belum diisi", className: "border-gray-200 bg-gray-100 text-gray-500" },
  };
  const state = states[status] ?? states.unchecked;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${state.className}`}>{state.icon}{state.label}</span>;
}

function ClientIdGuide({ onClose }: { onClose: () => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="soundcloud-guide-title" className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-2xl">
      <div className="flex items-start justify-between gap-4"><div><h3 id="soundcloud-guide-title" className="font-display text-base font-semibold text-gray-900">Panduan mengambil Client ID</h3><p className="mt-1 text-xs leading-5 text-gray-500">Client ID dipakai server hanya untuk pencarian lagu publik. Jangan pernah menempelkan Client Secret.</p></div><button type="button" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Tutup panduan"><X size={16} /></button></div>
      <ol className="mt-5 space-y-4 text-sm leading-6 text-gray-700">
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-gray-900 text-[10px] font-bold text-white">1</span><p>Masuk ke akun SoundCloud. Pendaftaran aplikasi API resmi saat ini memerlukan akun Artist Pro.</p></li>
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-gray-900 text-[10px] font-bold text-white">2</span><p>Buka halaman pendaftaran aplikasi, lalu isi nama aplikasi, deskripsi penggunaan untuk pencarian playlist kelas, dan alamat situs bila diminta.</p></li>
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-gray-900 text-[10px] font-bold text-white">3</span><p>Setujui ketentuan SoundCloud dan buat aplikasi. Dari halaman kredensial aplikasi, salin nilai <strong>Client ID</strong> saja.</p></li>
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-gray-900 text-[10px] font-bold text-white">4</span><p>Tempel Client ID di halaman ini, pilih <strong>Test</strong>, lalu <strong>Save</strong>. Jika pengujian gagal, nilai lama tetap disimpan dan tidak ditimpa.</p></li>
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-gray-900 text-[10px] font-bold text-white">5</span><p>Admin hanya dapat membantu mengganti ketika status ID lama sudah <strong>Kedaluwarsa</strong>. Owner dapat menggantinya kapan saja.</p></li>
      </ol>
      <a href="https://developers.soundcloud.com/docs/api/register-app" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-950">Buka panduan resmi SoundCloud <ExternalLink size={12} /></a>
      <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">Client Secret bersifat rahasia dan tidak dibutuhkan oleh kolom ini. Jangan kirim atau simpan Client Secret di dashboard.</p>
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
  const [testedClientId, setTestedClientId] = useState<string | null>(null);
  const [now, setNow] = useState(() => initial.checkedAt ? new Date(initial.checkedAt).getTime() : 0);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const canEditClientId = initial.actorRole === "owner" || !configured || status === "expired";

  function setCheckedStatus(next: string) { const checked = new Date().toISOString(); setStatus(next); setCheckedAt(checked); setNow(Date.now()); }

  async function saveClientId() {
    if (!clientId.trim() || testedClientId !== clientId.trim()) return;
    setBusy("client"); setMessage("");
    try {
      await request("/api/admin/music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-client-id", clientId }) });
      setConfigured(true); setCheckedStatus("valid"); setClientId(""); setTestedClientId(null); setMessage("Client ID valid dan tersimpan.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Gagal menyimpan."); }
    finally { setBusy(""); }
  }

  async function testClientId() {
    setBusy("test"); setMessage("");
    const candidate = clientId.trim();
    try {
      if (candidate) {
        await request("/api/admin/music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test-client-id-candidate", clientId: candidate }) });
        setTestedClientId(candidate);
        setMessage("Client ID baru valid dan siap disimpan.");
      } else {
        setTestedClientId(null);
        await request("/api/admin/music?action=test-client-id");
        setCheckedStatus("valid");
        setMessage("Client ID aktif masih valid.");
      }
    } catch (error) {
      if (candidate) setTestedClientId(null);
      if (!candidate) setCheckedStatus(error instanceof Error && /kedaluwarsa|ditolak/.test(error.message) ? "expired" : "error");
      setMessage(error instanceof Error ? error.message : "Pemeriksaan gagal.");
    }
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
      <header className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-display text-base font-semibold text-gray-900">SoundCloud Client ID</h2><p className="mt-0.5 text-xs text-gray-500">Dipakai server untuk pencarian. Nilai tersimpan tidak pernah ditampilkan kembali.</p></div><StatusBadge status={status} configured={configured} /></header>
      <div className="px-5 py-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input disabled={!canEditClientId} type={showClientId ? "text" : "password"} value={clientId} onChange={(event) => { setClientId(event.target.value); setTestedClientId(null); }} onKeyDown={(event) => { if (event.key === "Enter" && canEditClientId && testedClientId === clientId.trim()) void saveClientId(); }} placeholder={configured ? "••••••••••••••••••••" : "Tempel Client ID di sini"} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400" />
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowClientId((value) => !value)} disabled={!canEditClientId || !clientId} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">{showClientId ? <EyeOff size={14} /> : <Eye size={14} />}{showClientId ? "Hide" : "Show"}</button>
          <button type="button" onClick={testClientId} disabled={(!configured && !clientId.trim()) || busy === "test"} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">{busy === "test" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}Test</button>
        </div>
      </div>
      <div className="mt-3"><StatusLine status={status} configured={configured} checkedAt={checkedAt} now={now} /></div>
      {!canEditClientId ? <p className="mt-2 text-xs leading-5 text-gray-400">Client ID masih aktif. Admin hanya dapat menggantinya setelah status terdeteksi kedaluwarsa.</p> : null}
      <button type="button" onClick={saveClientId} disabled={!canEditClientId || !clientId.trim() || testedClientId !== clientId.trim() || busy === "client"} className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gray-900 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy === "client" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save</button>
      <div className="mt-5 border-t border-gray-100 pt-4">
        <button type="button" onClick={() => setShowGuide(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900"><HelpCircle size={14} />Kedaluwarsa? <ArrowRight size={12} /> Panduan Ambil Client ID</button>
      </div>
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
