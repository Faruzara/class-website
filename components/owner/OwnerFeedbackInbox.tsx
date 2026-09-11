"use client";

import { useMemo, useState } from "react";
import { Bug, Check, Clock3, Lightbulb, Loader2 } from "lucide-react";
import type { ApiResponse, FeedbackStatus, FeedbackSubmission } from "@/types";

const STATUS_LABEL: Record<FeedbackStatus, string> = { open: "Baru", reviewed: "Ditinjau", resolved: "Selesai" };

export default function OwnerFeedbackInbox({ initialFeedback }: { initialFeedback: FeedbackSubmission[] }) {
  const [items, setItems] = useState(initialFeedback);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const visible = useMemo(() => filter === "open" ? items.filter((item) => item.status !== "resolved") : items, [filter, items]);

  async function setStatus(id: string, status: FeedbackStatus) {
    setPendingId(id);
    setError("");
    try {
      const response = await fetch(`/api/owner/feedback/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json() as ApiResponse;
      if (!response.ok || !result.success) throw new Error(result.error ?? "Status gagal diperbarui.");
      setItems((current) => current.map((item) => item.id === id ? { ...item, status, updated_at: new Date().toISOString() } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Status gagal diperbarui.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section id="owner-feedback" className="scroll-mt-20 border-t border-surface-border py-10">
      <div className="mb-6 grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div><p className="font-mono text-[10px] text-brand-700">FEEDBACK</p><h2 className="mt-2 text-sm font-semibold text-gray-900">Bug & Feature Requests</h2></div>
        <div className="flex items-end justify-between gap-4"><p className="max-w-lg text-sm leading-6 text-gray-500">Pesan dari tombol feedback publik. Pengirim tidak diminta nama atau akun.</p><div className="inline-flex border border-surface-border p-1"><button type="button" onClick={() => setFilter("open")} className={`px-3 py-1.5 text-xs ${filter === "open" ? "bg-gray-900 text-white" : "text-gray-500"}`}>Aktif</button><button type="button" onClick={() => setFilter("all")} className={`px-3 py-1.5 text-xs ${filter === "all" ? "bg-gray-900 text-white" : "text-gray-500"}`}>Semua</button></div></div>
      </div>
      {error ? <p role="alert" className="mb-3 text-xs text-rose-700">{error}</p> : null}
      <div className="divide-y divide-surface-border border-y border-surface-border">
        {visible.length ? visible.map((item) => (
          <article key={item.id} className="grid gap-4 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
            <span className={`grid size-8 place-items-center ${item.type === "bug" ? "text-brand-700" : "text-amber-700"}`}>{item.type === "bug" ? <Bug size={17} /> : <Lightbulb size={17} />}</span>
            <div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] uppercase text-gray-500">{item.type === "bug" ? "Bug" : "Request Fitur"}</span><span className="text-gray-300">/</span><span className="text-[10px] text-gray-400">{STATUS_LABEL[item.status]}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{item.message}</p><p className="mt-2 text-xs text-gray-400">{item.page_path || "Halaman tidak diketahui"} · {new Date(item.created_at).toLocaleString("id-ID")}</p></div>
            <div className="flex gap-1 sm:flex-col">{pendingId === item.id ? <span className="grid size-9 place-items-center"><Loader2 size={15} className="animate-spin" /></span> : <><button type="button" onClick={() => setStatus(item.id, "reviewed")} disabled={item.status === "reviewed"} className="grid size-9 place-items-center text-gray-500 hover:text-amber-700 disabled:opacity-25" aria-label="Tandai ditinjau" title="Tandai ditinjau"><Clock3 size={15} /></button><button type="button" onClick={() => setStatus(item.id, "resolved")} disabled={item.status === "resolved"} className="grid size-9 place-items-center text-gray-500 hover:text-emerald-700 disabled:opacity-25" aria-label="Tandai selesai" title="Tandai selesai"><Check size={16} /></button></>}</div>
          </article>
        )) : <p className="py-10 text-center text-sm text-gray-500">Tidak ada feedback pada tampilan ini.</p>}
      </div>
    </section>
  );
}
