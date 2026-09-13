"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { JadwalItem, ScheduleColor } from "@/types";
import { getActiveScheduleWeek, offsetForScheduleWeek, type ScheduleWeek } from "@/lib/schedule-week";
import SchedulePdfImport from "@/components/admin/SchedulePdfImport";
import { SCHEDULE_COLOR_OPTIONS, scheduleColorTone } from "@/components/schedule/schedule-colors";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;
const SCHOOL_PERIODS = Array.from({ length: 11 }, (_, index) => index + 1);
type ScheduleForm = {
  subject: string;
  day: JadwalItem["day"];
  week: 1 | 2;
  room: string;
  start_period: number;
  end_period: number;
  color_override: ScheduleColor | null;
};

export default function ScheduleEditor({ initialItems, initialWeekOffset = 0 }: { initialItems: JadwalItem[]; initialWeekOffset?: number }) {
  const [items, setItems] = useState(initialItems);
  const [weekOffset, setWeekOffset] = useState(initialWeekOffset === 1 ? 1 : 0);
  const [switchingWeek, setSwitchingWeek] = useState(false);
  const [form, setForm] = useState<ScheduleForm>({ subject: "", day: "Senin", week: 1, room: "", start_period: 1, end_period: 2, color_override: null });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function refresh() {
    return fetch("/api/admin/jadwal").then((response) => response.json()).then((result) => {
      if (result.success) setItems(result.data);
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await fetch(editingId ? `/api/admin/jadwal/${editingId}` : "/api/admin/jadwal", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok || !result.success) return setError(result.error ?? (editingId ? "Gagal mengubah jadwal" : "Gagal menambah jadwal"));
      setEditingId(null);
      setForm({ subject: "", day: form.day, week: form.week, room: "", start_period: 1, end_period: 2, color_override: null });
      await refresh();
    });
  }

  function edit(item: JadwalItem) {
    setEditingId(item.id);
    setError(null);
    setForm({ subject: item.subject, day: item.day, week: item.week, room: item.room ?? "", start_period: item.start_period, end_period: item.end_period, color_override: item.color_override ?? null });
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
    setForm({ subject: "", day: form.day, week: form.week, room: "", start_period: 1, end_period: 2, color_override: null });
  }

  function remove(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/jadwal/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (result.success) {
        setItems((current) => current.filter((item) => item.id !== id));
        if (editingId === id) cancelEdit();
      }
    });
  }

  async function switchActiveWeek(week: ScheduleWeek) {
    const offset = offsetForScheduleWeek(week);
    if (offset === weekOffset || switchingWeek) return;
    setSwitchingWeek(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/jadwal", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schedule_week_offset: offset }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error ?? "Gagal mengganti Week aktif");
      setWeekOffset(offset);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal mengganti Week aktif");
    } finally {
      setSwitchingWeek(false);
    }
  }

  const activeWeek = getActiveScheduleWeek(weekOffset);

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Week aktif sekarang: Week {activeWeek}</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">Pilih Week untuk menyelaraskan jadwal. Setelah itu pergantian mingguan tetap otomatis.</p>
          </div>
          <div className="inline-flex rounded-lg border border-surface-border bg-surface-muted p-1">
            {([1, 2] as const).map((week) => <button key={week} type="button" onClick={() => void switchActiveWeek(week)} disabled={switchingWeek || activeWeek === week} className={`min-h-10 rounded-md px-4 text-sm font-medium transition-colors ${activeWeek === week ? "bg-white text-brand-700 shadow-sm" : "text-gray-500 hover:text-gray-900"} disabled:cursor-default`}>{switchingWeek && activeWeek !== week ? <Loader2 size={15} className="mx-auto animate-spin" /> : `Week ${week}`}</button>)}
          </div>
        </div>
      </section>
      <SchedulePdfImport onImported={refresh} />
      <form ref={formRef} onSubmit={submit} className="card grid scroll-mt-6 gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-4 sm:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900">{editingId ? "Edit jadwal" : "Tambah jadwal"}</h2>
          {editingId ? <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"><X size={14} /> Batal</button> : null}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm text-gray-600">Mata pelajaran</label>
          <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
        </div>
        <Field label="Hari">
          <select className="input" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value as JadwalItem["day"] })}>
            {DAYS.map((day) => <option key={day}>{day}</option>)}
          </select>
        </Field>
        <Field label="Minggu">
          <select className="input" value={form.week} onChange={(e) => setForm({ ...form, week: Number(e.target.value) as 1 | 2 })}>
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
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">Ruangan</label>
          <input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="P15 - LAB CNC" />
        </div>
        <Field label="Warna kartu">
          <div className="relative">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 rounded-md border ${form.color_override ? scheduleColorTone(form.color_override) : "border-gray-300 bg-gradient-to-br from-blue-100 via-emerald-100 to-pink-100"}`}
            />
            <select className="input pl-12" value={form.color_override ?? ""} onChange={(e) => setForm({ ...form, color_override: (e.target.value || null) as ScheduleColor | null })}>
              <option value="">Otomatis</option>
              {SCHEDULE_COLOR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </Field>
        {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
        <button className="btn-primary inline-flex items-center justify-center gap-2 sm:col-span-2 sm:justify-self-start" disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : editingId ? <Save size={16} /> : <Plus size={16} />} {editingId ? "Simpan Perubahan" : "Tambah Jadwal"}
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
                <div className="flex shrink-0 items-center">
                  <button type="button" onClick={() => edit(item)} className="p-2 text-gray-400 hover:text-brand-700" aria-label={`Edit ${item.subject}`}><Pencil size={16} /></button>
                  <button type="button" onClick={() => remove(item.id)} className="p-2 text-gray-400 hover:text-rose-600" aria-label={`Hapus ${item.subject}`}><Trash2 size={16} /></button>
                </div>
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
