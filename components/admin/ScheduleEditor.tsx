"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { JadwalItem } from "@/types";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const SCHOOL_PERIODS = Array.from({ length: 11 }, (_, index) => index + 1);

export default function ScheduleEditor({ initialItems }: { initialItems: JadwalItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState({ subject: "", day: "Senin", week: 1, room: "", start_period: 1, end_period: 2 });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    return fetch("/api/admin/jadwal").then((response) => response.json()).then((result) => {
      if (result.success) setItems(result.data);
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/jadwal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!result.success) return setError(result.error ?? "Gagal menambah jadwal");
      setForm((current) => ({ ...current, subject: "", room: "" }));
      await refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/jadwal/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (result.success) setItems((current) => current.filter((item) => item.id !== id));
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm text-gray-600">Mata pelajaran</label>
          <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
        </div>
        <Field label="Hari">
          <select className="input" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
            {DAYS.map((day) => <option key={day}>{day}</option>)}
          </select>
        </Field>
        <Field label="Minggu">
          <select className="input" value={form.week} onChange={(e) => setForm({ ...form, week: Number(e.target.value) })}>
            <option value={1}>Week 1</option><option value={2}>Week 2</option>
          </select>
        </Field>
        <Field label="Mulai jam ke-">
          <select className="input" value={form.start_period} onChange={(e) => {
            const startPeriod = Number(e.target.value);
            setForm({ ...form, start_period: startPeriod, end_period: Math.max(startPeriod, form.end_period) });
          }}>
            {SCHOOL_PERIODS.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </Field>
        <Field label="Sampai jam ke-">
          <select className="input" value={form.end_period} onChange={(e) => setForm({ ...form, end_period: Number(e.target.value) })}>
            {SCHOOL_PERIODS.filter((period) => period >= form.start_period).map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm text-gray-600">Ruangan</label>
          <input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="P15 - LAB CNC" />
        </div>
        {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
        <button className="btn-primary inline-flex items-center justify-center gap-2 sm:col-span-2 sm:justify-self-start" disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tambah Jadwal
        </button>
      </form>

      {[1, 2].map((week) => (
        <section key={week}>
          <h2 className="mb-3 font-semibold text-gray-900">Week {week}</h2>
          <div className="overflow-hidden rounded-xl border border-surface-border bg-white">
            {items.filter((item) => item.week === week).length === 0 ? (
              <p className="p-5 text-sm text-gray-500">Belum ada jadwal.</p>
            ) : items.filter((item) => item.week === week).map((item) => (
              <div key={item.id} className="flex items-center gap-4 border-b border-surface-border px-4 py-3 last:border-0">
                <span className="w-16 text-xs font-semibold text-brand-700">{item.day}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{item.subject}</p>
                  <p className="text-xs text-gray-500">Jam ke-{item.start_period}–{item.end_period}{item.room ? ` · ${item.room}` : ""}</p>
                </div>
                <button type="button" onClick={() => remove(item.id)} className="p-2 text-gray-400 hover:text-rose-600" aria-label={`Hapus ${item.subject}`}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-sm text-gray-600">{label}</label>{children}</div>;
}
