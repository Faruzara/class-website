"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Search, Trash2 } from "lucide-react";
import type { ApiResponse, MusicTrack, SoundCloudTrackResult } from "@/types";

type InitialState = { tracks: MusicTrack[]; clientIdConfigured: boolean; status: string; checkedAt: string | null };

export default function MusicManager({ initial }: { initial: InitialState }) {
  const [tracks, setTracks] = useState(initial.tracks);
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState(initial.status);
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [results, setResults] = useState<SoundCloudTrackResult[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function request(path: string, options?: RequestInit) {
    const response = await fetch(path, options);
    const result = await response.json() as ApiResponse<unknown>;
    if (!response.ok || !result.success) throw new Error(result.error ?? "Permintaan gagal.");
    return result.data;
  }

  async function saveClientId() {
    setBusy("client"); setMessage("");
    try { await request("/api/admin/music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-client-id", clientId }) }); setStatus("valid"); setClientId(""); setMessage("Client ID valid dan tersimpan."); }
    catch (error) { setStatus("expired"); setMessage(error instanceof Error ? error.message : "Gagal menyimpan."); }
    finally { setBusy(""); }
  }

  async function search() {
    if (query.trim().length < 2) return;
    setBusy("search"); setMessage("");
    try { setResults(await request(`/api/admin/music?q=${encodeURIComponent(query.trim())}`) as SoundCloudTrackResult[]); setStatus("valid"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Pencarian gagal."); }
    finally { setBusy(""); }
  }

  async function add(track?: SoundCloudTrackResult) {
    setBusy(track?.soundcloud_url ?? "url"); setMessage("");
    try {
      const added = await request("/api/admin/music", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(track ? { track } : { url }) }) as MusicTrack;
      setTracks((current) => [...current, added]); if (!track) setUrl(""); setMessage("Lagu ditambahkan ke playlist.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Gagal menambahkan."); }
    finally { setBusy(""); }
  }

  async function patch(track: MusicTrack, changes: Partial<MusicTrack>) {
    const optimistic = { ...track, ...changes };
    setTracks((current) => current.map((item) => item.id === track.id ? optimistic : item));
    try { await request(`/api/admin/music/${track.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) }); }
    catch (error) { setTracks((current) => current.map((item) => item.id === track.id ? track : item)); setMessage(error instanceof Error ? error.message : "Gagal memperbarui."); }
  }

  async function move(index: number, direction: -1 | 1) {
    const other = index + direction; if (other < 0 || other >= tracks.length) return;
    const next = [...tracks]; [next[index], next[other]] = [next[other], next[index]]; setTracks(next);
    await Promise.all([patch(next[index], { position: index }), patch(next[other], { position: other })]);
  }

  async function remove(track: MusicTrack) {
    if (!window.confirm(`Hapus “${track.title}” dari playlist?`)) return;
    try { await request(`/api/admin/music/${track.id}`, { method: "DELETE" }); setTracks((current) => current.filter((item) => item.id !== track.id)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Gagal menghapus."); }
  }

  const statusLabel = status === "valid" ? "Aktif" : status === "expired" ? "Ditolak / kedaluwarsa" : status === "error" ? "Belum dapat diperiksa" : initial.clientIdConfigured ? "Belum diperiksa" : "Belum diisi";
  return <div className="space-y-6">
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="font-display text-lg font-semibold">SoundCloud Client ID</h2><p className="mt-1 text-xs text-gray-500">Dipakai hanya oleh server untuk pencarian. Nilai tersimpan tidak pernah ditampilkan kembali.</p><div className="mt-4 flex gap-2"><input type="password" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={initial.clientIdConfigured ? "Isi untuk mengganti client ID" : "Tempel client ID"} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400" /><button onClick={saveClientId} disabled={!clientId.trim() || busy === "client"} className="rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-40">{busy === "client" ? <Loader2 className="animate-spin" size={16} /> : "Simpan & cek"}</button></div><p className={`mt-2 text-xs ${status === "valid" ? "text-emerald-700" : status === "expired" ? "text-rose-700" : "text-amber-700"}`}>Status: {statusLabel}</p></section>
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="font-display text-lg font-semibold">Tambah lagu</h2><div className="mt-4 flex gap-2"><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder="Cari lagu atau artis" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm" /><button onClick={search} disabled={busy === "search"} className="grid size-10 place-items-center rounded-xl bg-gray-900 text-white">{busy === "search" ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}</button></div><div className="my-3 flex items-center gap-3 text-[10px] uppercase tracking-widest text-gray-400"><span className="h-px flex-1 bg-gray-100" />atau lewat link<span className="h-px flex-1 bg-gray-100" /></div><div className="flex gap-2"><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://soundcloud.com/..." className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm" /><button onClick={() => add()} disabled={!url.trim() || busy === "url"} className="grid size-10 place-items-center rounded-xl bg-gray-900 text-white"><Plus size={16} /></button></div>{results.length ? <div className="mt-4 divide-y divide-gray-100">{results.map((track) => <div key={track.soundcloud_url} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{track.title}</p><p className="truncate text-xs text-gray-500">{track.artist}</p></div><button onClick={() => add(track)} disabled={Boolean(busy)} className="grid size-9 place-items-center rounded-xl border border-gray-200"><Plus size={15} /></button></div>)}</div> : null}</section>
    {message ? <p role="status" className="text-sm text-gray-600">{message}</p> : null}
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-end justify-between"><div><h2 className="font-display text-lg font-semibold">Playlist publik</h2><p className="text-xs text-gray-500">Hanya lagu berstatus tampil yang muncul di Menu 2.</p></div><span className="text-xs text-gray-400">{tracks.length} lagu</span></div><div className="mt-3 divide-y divide-gray-100">{tracks.length ? tracks.map((track, index) => <div key={track.id} className="flex items-center gap-2 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{track.title}</p><p className="truncate text-xs text-gray-500">{track.artist}</p></div><label className="flex items-center gap-1 text-[10px] text-gray-500"><input type="checkbox" checked={track.is_active} onChange={(e) => patch(track, { is_active: e.target.checked })} /> Tampil</label><button onClick={() => move(index, -1)} disabled={index === 0} className="p-1.5 disabled:opacity-20" aria-label="Naik"><ArrowUp size={14} /></button><button onClick={() => move(index, 1)} disabled={index === tracks.length - 1} className="p-1.5 disabled:opacity-20" aria-label="Turun"><ArrowDown size={14} /></button><button onClick={() => remove(track)} className="p-1.5 text-rose-600" aria-label="Hapus"><Trash2 size={14} /></button></div>) : <p className="py-8 text-center text-sm text-gray-400">Playlist masih kosong.</p>}</div></section>
  </div>;
}
