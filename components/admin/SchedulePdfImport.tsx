"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import type { ApiResponse, ParsedScheduleClass } from "@/types";

type ImportResult = { inserted: number; updated: number; unchanged: number };

function normalizedClassName(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export default function SchedulePdfImport({ onImported }: { onImported: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [classes, setClasses] = useState<ParsedScheduleClass[]>([]);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [fileName, setFileName] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [state, setState] = useState<"idle" | "reading" | "importing" | "done">("idle");
  const [message, setMessage] = useState("");
  const selected = classes.find((item) => item.page_number === selectedPage) ?? null;

  function reset() {
    setClasses([]);
    setSelectedPage(null);
    setFileName("");
    setMode("merge");
    setState("idle");
    setMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function readPdf(file: File) {
    setState("reading");
    setMessage("");
    setFileName(file.name);
    setClasses([]);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/admin/jadwal/import/preview", { method: "POST", body: form });
      const result = await response.json() as ApiResponse<ParsedScheduleClass[]>;
      if (!response.ok || !result.success || !result.data?.length) throw new Error(result.error ?? "PDF tidak dapat dibaca");
      setClasses(result.data);
      const currentName = normalizedClassName(process.env.NEXT_PUBLIC_APP_NAME ?? "");
      const suggested = result.data.find((item) => normalizedClassName(item.class_name) === currentName) ?? result.data[0];
      setSelectedPage(suggested.page_number);
      setState("idle");
    } catch (error) {
      setState("idle");
      setMessage(error instanceof Error ? error.message : "PDF tidak dapat dibaca");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function importSchedule() {
    if (!selected || state === "importing") return;
    setState("importing");
    setMessage("");
    try {
      const response = await fetch("/api/admin/jadwal/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_name: selected.class_name, mode, items: selected.items }),
      });
      const result = await response.json() as ApiResponse<ImportResult>;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Import jadwal gagal");
      await onImported();
      setState("done");
      setMessage(`${result.data.inserted} baru, ${result.data.updated} diperbarui, ${result.data.unchanged} sudah sesuai.`);
    } catch (error) {
      setState("idle");
      setMessage(error instanceof Error ? error.message : "Import jadwal gagal");
    }
  }

  return (
    <section className="card">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void readPdf(file);
        }}
      />

      {!classes.length ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Import jadwal dari PDF</h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">Mendeteksi semua kelas dari PDF aSc Timetables. Maksimal 10 MB.</p>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={state === "reading"} className="btn-secondary inline-flex shrink-0 items-center justify-center gap-2">
            {state === "reading" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {state === "reading" ? "Membaca PDF..." : "Pilih PDF"}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <FileText size={19} className="mt-0.5 shrink-0 text-brand-700" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold text-gray-900">{fileName}</h2>
              <p className="mt-1 text-xs text-gray-500">{classes.length} kelas terdeteksi. Pilih satu kelas untuk portal ini.</p>
            </div>
            <button type="button" onClick={reset} className="p-1.5 text-gray-400 hover:text-gray-900" aria-label="Tutup import PDF"><X size={16} /></button>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-gray-600" htmlFor="schedule-pdf-class">Kelas dari PDF</label>
            <select id="schedule-pdf-class" className="input" value={selectedPage ?? ""} onChange={(event) => { setSelectedPage(Number(event.target.value)); setState("idle"); setMessage(""); }}>
              {classes.map((item) => <option key={item.page_number} value={item.page_number}>{item.class_name} · halaman {item.page_number} · {item.items.length} blok</option>)}
            </select>
          </div>

          {selected ? (
            <>
              <div className="max-h-72 overflow-auto rounded-xl border border-surface-border bg-white">
                {[1, 2].map((week) => (
                  <div key={week} className="border-b border-surface-border last:border-0">
                    <p className="sticky top-0 border-b border-surface-border bg-surface-muted px-4 py-2 text-xs font-semibold text-gray-700">Week {week}</p>
                    {selected.items.filter((item) => item.week === week).map((item, index) => (
                      <div key={`${week}-${item.day}-${item.start_period}-${index}`} className="flex gap-3 border-b border-surface-border/70 px-4 py-2.5 text-xs last:border-0">
                        <span className="w-14 shrink-0 font-semibold text-brand-700">{item.day}</span>
                        <span className="min-w-0 flex-1 text-gray-800">{item.subject}<span className="block truncate text-gray-500">Jam {item.start_period}–{item.end_period}{item.room ? ` · ${item.room}` : ""}</span></span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-1">
                <button type="button" onClick={() => setMode("merge")} className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors ${mode === "merge" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>Gabungkan</button>
                <button type="button" onClick={() => setMode("replace")} className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors ${mode === "replace" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>Ganti Jadwal</button>
              </div>
              <p className="text-xs leading-5 text-gray-500">{mode === "merge" ? "Menambah dan memperbarui entri yang cocok. Import berhenti jika bertabrakan dengan data lain." : "Menghapus seluruh jadwal Week 1/2 saat ini, lalu menggantinya dengan kelas yang dipilih."}</p>

              {message ? <p className={`text-sm ${state === "done" ? "text-emerald-700" : "text-rose-600"}`}>{state === "done" ? <CheckCircle2 size={15} className="mr-1.5 inline" /> : null}{message}</p> : null}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary">Pilih PDF lain</button>
                <button type="button" onClick={() => void importSchedule()} disabled={state === "importing" || state === "done"} className="btn-primary inline-flex items-center justify-center gap-2">
                  {state === "importing" ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {state === "done" ? "Sudah Diimpor" : state === "importing" ? "Mengimpor..." : `Import ${selected.class_name}`}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {!classes.length && message ? <p className="mt-3 text-sm text-rose-600">{message}</p> : null}
    </section>
  );
}
